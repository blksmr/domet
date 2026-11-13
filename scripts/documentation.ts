import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SyncResults {
  [key: string]: "success" | "error";
}

interface FrontmatterData {
  title?: string;
  description?: string;
  [key: string]: string | undefined;
}

const sourceFile = path.join(__dirname, "../website/content/documentation.mdx");
const siteConfigFile = path.join(__dirname, "../website/config/site.ts");
const targetFiles: Record<string, string> = {
  "README.md": path.join(__dirname, "../README.md"),
  "website/public/llms.txt": path.join(__dirname, "../website/public/llms.txt"),
  "packages/domet/README.md": path.join(
    __dirname,
    "../packages/domet/README.md",
  ),
};

function extractFrontmatter(content: string): {
  frontmatter: FrontmatterData;
  content: string;
} {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n*/);
  if (!frontmatterMatch) {
    return { frontmatter: {}, content };
  }

  const frontmatterYaml = frontmatterMatch[1];
  const remainingContent = content.slice(frontmatterMatch[0].length);

  const titleMatch = frontmatterYaml.match(/title:\s*["']?(.*?)["']?\s*$/m);
  const descMatch = frontmatterYaml.match(/description:\s*["']?(.*?)["']?\s*$/m);
  const frontmatter: FrontmatterData = {};
  if (titleMatch) {
    frontmatter.title = titleMatch[1];
  }
  if (descMatch) {
    frontmatter.description = descMatch[1];
  }

  return { frontmatter, content: remainingContent };
}

function transformPropTable(match: string): string {
  const items: Array<{
    name: string;
    type: string;
    default?: string;
    description: string;
  }> = [];

  const stringPattern = `"((?:[^"\\\\]|\\\\.)*)"`;
  const itemRegex = new RegExp(
    `\\{\\s*name:\\s*${stringPattern},\\s*type:\\s*${stringPattern}(?:,\\s*default:\\s*${stringPattern})?,\\s*description:\\s*${stringPattern}\\s*\\}`,
    "g"
  );

  let itemMatch: RegExpExecArray | null;
  while ((itemMatch = itemRegex.exec(match)) !== null) {
    const unescape = (s: string) => s.replace(/\\(.)/g, "$1");
    items.push({
      name: unescape(itemMatch[1]),
      type: unescape(itemMatch[2]),
      default: itemMatch[3] ? unescape(itemMatch[3]) : undefined,
      description: unescape(itemMatch[4]),
    });
  }

  if (items.length === 0) {
    throw new Error(
      "PropTable could not be parsed. Use double-quoted name, type, default and description.",
    );
  }

  const hasDefault = items.some((item) => item.default !== undefined);

  const escapeType = (type: string) => type.replace(/\|/g, "\\|").replace(/`/g, "\\`");

  if (hasDefault) {
    const header = "| Prop | Type | Default | Description |";
    const separator = "|------|------|---------|-------------|";
    const rows = items.map(
      (item) =>
        `| \`${item.name}\` | \`${escapeType(item.type)}\` | ${item.default ? `\`${item.default}\`` : "—"} | ${item.description} |`,
    );
    return [header, separator, ...rows].join("\n");
  }
  const header = "| Prop | Type | Description |";
  const separator = "|------|------|-------------|";
  const rows = items.map(
    (item) =>
      `| \`${item.name}\` | \`${escapeType(item.type)}\` | ${item.description} |`,
  );
  return [header, separator, ...rows].join("\n");
}

const LOCAL_URL_MAP: Record<string, string> = {
  "/llms.txt": "./website/public/llms.txt",
};

function transformLocalUrls(content: string): string {
  return content.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (match, text, url) => {
      const mapped = LOCAL_URL_MAP[url];
      return mapped ? `[${text}](${mapped})` : match;
    }
  );
}

function transformContent(content: string, forReadme = false): string {
  const { frontmatter, content: bodyContent } = extractFrontmatter(content);
  const title = frontmatter.title || "domet";

  let transformed = `# ${title}\n\n${bodyContent}`;

  transformed = transformed.replace(/<Demo[^>]*\/>(\s*\n)*/g, "");

  transformed = transformed.replace(/\+\+([^+]+)\+\+/g, "");

  transformed = transformed.replace(
    /<PropTable\s+items=\{\[([\s\S]*?)\]\}\s*\/>/g,
    (match) => transformPropTable(match),
  );

  if (forReadme) {
    transformed = transformLocalUrls(transformed);
  }

  transformed = transformed.replace(/\n{3,}/g, "\n\n");
  return `${transformed.trim()}\n`;
}

function updateSiteConfig(frontmatter: FrontmatterData): "success" | "error" {
  try {
    const content = fs.readFileSync(siteConfigFile, "utf8");
    const title = frontmatter.title || "Domet";
    const description = frontmatter.description || "A lightweight scroll spy hook for React";

    let updated = content.replace(
      /export const APP_NAME = ".*?";/,
      `export const APP_NAME = "${title}";`
    );
    updated = updated.replace(
      /export const APP_DESCRIPTION = ".*?";/,
      `export const APP_DESCRIPTION = "${description}";`
    );

    fs.writeFileSync(siteConfigFile, updated);
    return "success";
  } catch (error) {
    console.error(
      "Error writing website/config/site.ts:",
      (error as Error).message,
    );
    return "error";
  }
}

function formatTreeOutput(results: SyncResults): void {
  console.log("○ Syncing Documentation");

  const entries = Object.entries(results);
  entries.forEach(([file, status], index) => {
    const isLast = index === entries.length - 1;
    const prefix = isLast ? "└" : "├";
    const statusIcon = status === "success" ? "○" : "✗";
    console.log(`${prefix} ${statusIcon} ${file}`);
  });
}

function syncDocumentation(): void {
  const results: SyncResults = {};
  const updatedFiles: string[] = [];

  try {
    const sourceContent = fs.readFileSync(sourceFile, "utf8");
    const { frontmatter } = extractFrontmatter(sourceContent);

    results["website/config/site.ts"] = updateSiteConfig(frontmatter);
    if (results["website/config/site.ts"] === "success") {
      updatedFiles.push("website/config/site.ts");
    }

    const transformedContent = transformContent(sourceContent);
    const transformedContentForReadme = transformContent(sourceContent, true);

    Object.entries(targetFiles).forEach(([displayName, filePath]) => {
      try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        const isReadme = displayName.endsWith("README.md");
        const content = isReadme ? transformedContentForReadme : transformedContent;
        fs.writeFileSync(filePath, content);
        results[displayName] = "success";

        const relativePath = path.relative(
          path.join(__dirname, ".."),
          filePath,
        );
        updatedFiles.push(relativePath);
      } catch (error) {
        results[displayName] = "error";
        console.error(
          `Error writing ${displayName}:`,
          (error as Error).message,
        );
      }
    });

    formatTreeOutput(results);

    if (Object.values(results).includes("error")) {
      process.exit(1);
    }

    if (updatedFiles.length > 0) {
      console.log(updatedFiles.join(" "));
    }
  } catch (error) {
    console.error("❌ Error syncing documentation:", (error as Error).message);
    process.exit(1);
  }
}

syncDocumentation();
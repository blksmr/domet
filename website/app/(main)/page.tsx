import { APP_NAME, siteConfig } from "@/config/site";
import { getHomePage } from "@/lib/fumadocs";
import { getMDXComponents } from "@/mdx-components";
import { HeaderMenu } from "@/components/HeaderMenu";
import packageJson from "../../../packages/domet/package.json";
import Link from "next/link";

export const metadata = siteConfig;

export default function Page() {
  const page = getHomePage();

  if (!page) {
    return <div>Not found</div>;
  }

  const MDX = page.data.body;

  return (
    <article>
      <header className="flex w-full mb-6">
        <div className="flex gap-2 items-center font-medium">{APP_NAME}</div>
        <div className="flex items-center gap-3 ml-auto">
          <Link className="flex items-center text-xs text-muted hover:text-hover no-underline" href={`https://www.npmjs.com/package/domet`} title="View on npm">
            v{packageJson.version}
          </Link>
          <HeaderMenu />
        </div>
      </header>
      <MDX components={getMDXComponents()} />
    </article>
  );
}

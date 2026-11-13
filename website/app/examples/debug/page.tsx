"use client";

import dynamic from "next/dynamic";

const Debug = dynamic(
  () => import("@/components/examples/Debug").then((m) => m.Debug),
  { ssr: false }
);

export default function Page() {
  return <Debug />;
}

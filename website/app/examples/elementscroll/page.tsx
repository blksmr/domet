"use client";

import dynamic from "next/dynamic";

const ElementScroll = dynamic(
  () => import("@/components/examples/ElementScroll").then((m) => m.ElementScroll),
  { ssr: false }
);

export default function Page() {
  return <ElementScroll />;
}

"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { NavigationPending } from "@/components/navigation-provider";

export default function NavigationLink({ children, ...props }: ComponentProps<typeof NextLink>) {
  return (
    <NextLink {...props}>
      {children}
      <NavigationPending />
    </NextLink>
  );
}

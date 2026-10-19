// Purpose: helper module that the shadcn CLI expects at "@/lib/utils".
// New components added with `npx shadcn add` import `cn` from here, so this
// file simply re-exports `cn` (which merges Tailwind class names) from the "cn" package.
export { cn } from "cn";

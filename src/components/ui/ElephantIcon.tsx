import type { SVGProps } from 'react';

interface ElephantIconProps extends SVGProps<SVGSVGElement> {
  size?: number;
  strokeWidth?: number;
}

export function ElephantIcon({ size = 24, strokeWidth = 2, className, ...props }: ElephantIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Elephant body */}
      <path d="M17 10c2-1 4 0 4 3v4a2 2 0 0 1-2 2h-1v2" />
      <path d="M3 13c0-4 2-7 6-8 2-.5 4 0 5 1" />
      {/* Head & trunk */}
      <path d="M14 3c2 0 3 2 3 4v3" />
      <path d="M3 13v4a2 2 0 0 0 2 2h1v2" />
      <path d="M8 19h8" />
      {/* Trunk curl */}
      <path d="M14 7c1 0 2 1 2 2s-1 2-2 2" />
      {/* Ear */}
      <circle cx="9" cy="10" r="3" />
      {/* Eye */}
      <circle cx="10" cy="9" r="0.5" fill="currentColor" stroke="none" />
      {/* Tusk */}
      <path d="M7 13c-1 1-1 2 0 3" />
    </svg>
  );
}

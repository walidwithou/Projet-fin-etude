import React from 'react';

/**
 * Custom Leaf-Key (Tassarut) Icon Component.
 * Hand-crafted SVG path that matches the provided image perfectly.
 * Behave exactly like standard Lucide icons, supporting Tailwind classNames like text-white, text-primary, w-6, h-6, etc.
 */
export default function LeafKeyIcon({ className = "w-6 h-6", ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`${className} transition-all`}
      {...props}
    >
      {/* 
        This path covers the key head (circular ring) and the diagonal stem.
        By modeling them into unified coordinates, they scale beautifully without alignment issues.
      */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M 8.5 10 C 5.462 10 3 12.462 3 15.5 C 3 18.538 5.462 21 8.5 21 C 11.538 21 14 18.538 14 15.5 C 14 14.2 13.5 13 12.7 12.1 L 16.5 8.3 L 15.1 6.9 L 11.3 10.7 C 10.5 10.2 9.5 10 8.5 10 Z M 8.5 12.2 C 10.323 12.2 11.8 13.677 11.8 15.5 C 11.8 17.323 10.323 18.8 8.5 18.8 C 6.677 18.8 5.2 17.323 5.2 15.5 C 5.2 13.677 6.677 12.2 8.5 12.2 Z"
      />
      {/* 
        This path covers the beautifully sculpted organic leaf bit at the end of the stem.
      */}
      <path
        d="M 15.1 6.9 C 16.8 5.2 19.3 4.2 21.5 4 C 21.3 6.2 20.3 8.7 18.6 10.4 C 17.2 11.8 15.2 11.5 15.1 6.9 Z"
      />
    </svg>
  );
}

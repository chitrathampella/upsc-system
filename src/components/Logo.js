import React from 'react';

const Logo = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Hexagon Border */}
    <path d="M50 5L90 27.5V72.5L50 95L10 72.5V27.5L50 5Z" stroke="#00f2ff" strokeWidth="2" fill="rgba(0, 242, 255, 0.05)"/>
    {/* Inner "S" or "C" Stylized */}
    <path d="M35 35H65L35 50H65L35 65H65" stroke="#00f2ff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    {/* Glow Effect */}
    <defs>
      <filter id="glow">
        <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
  </svg>
);

export default Logo;
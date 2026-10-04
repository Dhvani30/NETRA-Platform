import { useInView } from './useInView.jsx';

export function AnimatedLine({
  pathD,
  stroke = 'var(--accent)',
  strokeWidth = 2,
  duration = 900,
  delay = 0,
  dashArray = 500,
  className = ''
}) {
  const [ref, isInView] = useInView({ once: true });

  const lineStyle = {
    strokeDasharray: dashArray,
    strokeDashoffset: isInView ? 0 : dashArray,
    transition: `stroke-dashoffset ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
    willChange: 'stroke-dashoffset'
  };

  return (
    <svg ref={ref} className={`overflow-visible ${className}`}>
      <path
        d={pathD}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        style={lineStyle}
      />
    </svg>
  );
}

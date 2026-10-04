import { useState, useEffect, useRef } from 'react';

export function useInView(options = {}) {
  const ref = useRef(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Check for prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
        if (options.once !== false) {
          observer.unobserve(element);
        }
      } else if (!options.once) {
        setIsInView(false);
      }
    }, {
      threshold: options.threshold || 0.15,
      rootMargin: options.rootMargin || '0px 0px -50px 0px'
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [options.threshold, options.rootMargin, options.once]);

  return [ref, isInView];
}

export function Reveal({
  children,
  direction = 'up',
  delay = 0,
  duration = 400,
  className = '',
  style = {}
}) {
  const [ref, isInView] = useInView({ once: true });

  const getTransform = () => {
    if (isInView) return 'translate3d(0, 0, 0)';
    switch (direction) {
      case 'up': return 'translate3d(0, 16px, 0)';
      case 'down': return 'translate3d(0, -16px, 0)';
      case 'left': return 'translate3d(20px, 0, 0)';
      case 'right': return 'translate3d(-20px, 0, 0)';
      default: return 'translate3d(0, 16px, 0)';
    }
  };

  const animStyle = {
    ...style,
    opacity: isInView ? 1 : 0,
    transform: getTransform(),
    transition: `opacity ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
    willChange: 'opacity, transform'
  };

  return (
    <div ref={ref} className={className} style={animStyle}>
      {children}
    </div>
  );
}

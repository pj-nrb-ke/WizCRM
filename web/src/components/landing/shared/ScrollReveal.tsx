import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  className?: string;
  style?: React.CSSProperties;
};

export function ScrollReveal({ children, delay = 0, direction = 'up', className, style }: Props) {
  const initial = {
    opacity: 0,
    y: direction === 'up' ? 32 : direction === 'down' ? -32 : 0,
    x: direction === 'left' ? 32 : direction === 'right' ? -32 : 0,
  };

  return (
    <motion.div
      initial={initial}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

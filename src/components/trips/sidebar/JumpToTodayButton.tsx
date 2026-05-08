'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronDown } from 'lucide-react';

interface JumpToTodayButtonProps {
  visible: boolean;
  onJump: () => void;
}

function JumpToTodayButton({ visible, onJump }: JumpToTodayButtonProps) {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.button
          type="button"
          onClick={onJump}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="sticky top-1 z-10 self-center mx-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 backdrop-blur-md border border-blue-300/40 text-blue-200 font-bold text-[11px] shadow-md"
          aria-label="Saltar a hoy"
        >
          <Calendar className="w-3 h-3" />
          <span>Saltar a hoy</span>
          <motion.span
            animate={{ y: [0, 2, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            className="inline-flex"
          >
            <ChevronDown className="w-3 h-3" />
          </motion.span>
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}

export default JumpToTodayButton;

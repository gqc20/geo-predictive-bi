import React from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ 
  title, 
  value, 
  subValue, 
  icon: Icon, 
  trend, 
  trendValue 
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      className="glass p-6 rounded-2xl flex flex-col justify-between"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-brand-500/20 rounded-lg">
          <Icon className="w-5 h-5 text-brand-400" />
        </div>
        {trend && (
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
            trend === 'up' ? 'bg-emerald-500/20 text-emerald-400' : 
            trend === 'down' ? 'bg-rose-500/20 text-rose-400' : 
            'bg-slate-500/20 text-slate-400'
          }`}>
            {trendValue}
          </span>
        )}
      </div>
      
      <div>
        <h3 className="text-slate-400 text-sm font-medium mb-1">{title}</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white">{value}</span>
          {subValue && <span className="text-xs text-slate-500">{subValue}</span>}
        </div>
      </div>
    </motion.div>
  );
};

export default StatsCard;

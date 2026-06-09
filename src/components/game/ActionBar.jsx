import { useState, useEffect } from 'react';
import { Zap, Crosshair, Shield, Swords, ArrowLeftRight, Compass, Eye, Clock, Flame, Bus } from 'lucide-react';

const SHOUTS = [
  { key:'push_up', label:'Push Up!', ap:1, icon:Flame, desc:'Push higher up the pitch' },
  { key:'hold_firm', label:'Hold Firm!', ap:1, icon:Shield, desc:'Drop deeper defensively' },
  { key:'wide_play', label:'Wide Play!', ap:1, icon:ArrowLeftRight, desc:'Focus attacks down the wings' },
  { key:'through_middle', label:'Through Middle!', ap:1, icon:Compass, desc:'Attack through the centre' },
  { key:'slow_down', label:'Slow it Down', ap:1, icon:Clock, desc:'Keep possession, slow tempo' },
  { key:'press_hard', label:'Press Hard!', ap:1, icon:Swords, desc:'Intense pressing, higher foul risk' },
];

const ACTIONS = [
  { key:'demand_shot', label:'Demand Shot', ap:2, icon:Crosshair, desc:'Force a shot on the next tick' },
  { key:'killer_ball', label:'Killer Ball', ap:2, icon:Eye, desc:'Force a through ball next tick' },
  { key:'hard_tackle', label:'Hard Tackle', ap:2, icon:Zap, desc:'Aggressive tackle with +15 bonus' },
];

export default function ActionBar({ teamKey, minute, apRemaining, possession, activeShout, scoreDiff, canSub, subsUsed, onShout, onAction, onSub }) {
  const [tab, setTab] = useState('shouts');

  const isOurTurn = possession === teamKey;

  return (
    <div className="w-full bg-card/95 backdrop-blur border-t border-border/60 rounded-t-xl">
      {/* Tabs */}
      <div className="flex border-b border-border/40">
        <button
          onClick={() => setTab('shouts')}
          className={`flex-1 py-2 text-[10px] font-heading tracking-wider uppercase ${tab === 'shouts' ? 'text-gold border-b-2 border-gold' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Shouts
        </button>
        <button
          onClick={() => setTab('actions')}
          className={`flex-1 py-2 text-[10px] font-heading tracking-wider uppercase ${tab === 'actions' ? 'text-gold border-b-2 border-gold' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Actions
        </button>
        <button
          onClick={() => setTab('subs')}
          className={`flex-1 py-2 text-[10px] font-heading tracking-wider uppercase ${tab === 'subs' ? 'text-gold border-b-2 border-gold' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Subs
        </button>
      </div>

      {/* Content */}
      <div className="p-2 max-h-48 overflow-y-auto space-y-1.5">
        {tab === 'shouts' && SHOUTS.map((s) => {
          const canUse = apRemaining >= s.ap && activeShout !== s.key;
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              disabled={!canUse}
              onClick={() => onShout(s.key)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-all ${
                canUse ? 'bg-secondary hover:bg-gold/20 text-foreground hover:text-gold cursor-pointer' : 'bg-muted/30 text-muted-foreground/50 cursor-not-allowed'
              }`}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <div className="flex-1 text-left">
                <span className="font-heading font-bold text-[10px]">{s.label}</span>
                <p className="text-[8px] text-muted-foreground">{s.desc}</p>
              </div>
              <span className="font-heading text-[9px] text-gold">{s.ap} AP</span>
            </button>
          );
        })}

        {tab === 'actions' && (
          <>
            {ACTIONS.map((a) => {
              let canUse = apRemaining >= a.ap;
              if (a.key === 'demand_shot' || a.key === 'killer_ball') canUse = canUse && isOurTurn;
              if (a.key === 'hard_tackle') canUse = canUse && !isOurTurn;
              const Icon = a.icon;
              return (
                <button
                  key={a.key}
                  disabled={!canUse}
                  onClick={() => onAction(a.key)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-all ${
                    canUse ? 'bg-secondary hover:bg-gold/20 text-foreground hover:text-gold cursor-pointer' : 'bg-muted/30 text-muted-foreground/50 cursor-not-allowed'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <span className="font-heading font-bold text-[10px]">{a.label}</span>
                    <p className="text-[8px] text-muted-foreground">{a.desc}</p>
                  </div>
                  <span className="font-heading text-[9px] text-gold">{a.ap} AP</span>
                </button>
              );
            })}

            {/* All Out Attack / Park the Bus */}
            <button
              disabled={apRemaining < 3}
              onClick={() => onAction('all_out_attack')}
              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-all ${
                apRemaining >= 3 ? 'bg-red-900/30 hover:bg-red-800/40 text-red-300 cursor-pointer' : 'bg-muted/30 text-muted-foreground/50 cursor-not-allowed'
              }`}
            >
              <Flame className="w-3.5 h-3.5 flex-shrink-0" />
              <div className="flex-1 text-left">
                <span className="font-heading font-bold text-[10px]">All Out Attack</span>
                <p className="text-[8px] text-muted-foreground">Expensive — sends everyone forward (3 AP)</p>
              </div>
              <span className="font-heading text-[9px] text-gold">3 AP</span>
            </button>
            <button
              disabled={apRemaining < 3}
              onClick={() => onAction('park_the_bus')}
              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-all ${
                apRemaining >= 3 ? 'bg-blue-900/30 hover:bg-blue-800/40 text-blue-300 cursor-pointer' : 'bg-muted/30 text-muted-foreground/50 cursor-not-allowed'
              }`}
            >
              <Bus className="w-3.5 h-3.5 flex-shrink-0" />
              <div className="flex-1 text-left">
                <span className="font-heading font-bold text-[10px]">Park the Bus</span>
                <p className="text-[8px] text-muted-foreground">Everyone back (3 AP, 15 min)</p>
              </div>
              <span className="font-heading text-[9px] text-gold">3 AP</span>
            </button>
          </>
        )}

        {tab === 'subs' && (
          <p className="text-[10px] text-muted-foreground text-center py-4">
            Subs used: {subsUsed}/3
          </p>
        )}
      </div>
    </div>
  );
}

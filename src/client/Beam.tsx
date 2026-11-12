import { PEGS, REACH } from '../shared/puzzle';
import { tiltFor, weightSize } from './lib/geometry';

export type BeamWeight = { key: string; pos: number; w: number; fixed: boolean; fresh?: boolean };

type Props = {
  weights: BeamWeight[];
  net: number;
  level: boolean;
  armed: boolean;
  onPeg?: ((pos: number) => void) | undefined;
  onWeight?: ((key: string) => void) | undefined;
  compact?: boolean | undefined;
};

const W = 360;
const PIVOT_X = W / 2;
const BEAM_Y = 150;
const STEP = 31;


const WeightShape = ({ w, fixed }: { w: number; fixed: boolean }) => {
  const { h, top, base } = weightSize(w);
  return (
    <g>
      <path
        d={`M ${-top / 2} ${-h} L ${top / 2} ${-h} L ${base / 2} -3 Q ${base / 2} 0 ${base / 2 - 3} 0 L ${-base / 2 + 3} 0 Q ${-base / 2} 0 ${-base / 2} -3 Z`}
        className={fixed ? 'wt wt-fixed' : 'wt'}
      />
      <rect x={-5} y={-h - 7} width={10} height={8} rx={3} className={fixed ? 'wt-knob wt-fixed' : 'wt-knob'} />
      <text x={0} y={-h * 0.38} className="wt-num" textAnchor="middle" dominantBaseline="middle">
        {w}
      </text>
    </g>
  );
};

export const WeightIcon = ({ w, fixed = false }: { w: number; fixed?: boolean }) => {
  const { h, base } = weightSize(w);
  return (
    <svg viewBox={`${-base / 2 - 2} ${-h - 9} ${base + 4} ${h + 11}`} width={base + 4} height={h + 11} aria-hidden="true">
      <WeightShape w={w} fixed={fixed} />
    </svg>
  );
};

export const Beam = ({ weights, net, level, armed, onPeg, onWeight, compact }: Props) => {
  const angle = tiltFor(net);
  // Spirit-level bubble drifts toward the high side.
  const bubble = Math.max(-7, Math.min(7, -angle * 0.9));
  return (
    <svg
      viewBox={compact ? '0 50 360 165' : '0 40 360 178'}
      className={`beam ${level ? 'is-level' : ''}`}
      role="group"
      aria-label={level ? 'The beam is level' : net > 0 ? 'The beam tips right' : net < 0 ? 'The beam tips left' : 'The beam is empty'}
    >
      <path d={`M ${PIVOT_X} ${BEAM_Y + 4} L ${PIVOT_X - 26} 206 L ${PIVOT_X + 26} 206 Z`} className="fulcrum" />
      <rect x={PIVOT_X - 60} y={204} width={120} height={8} rx={4} className="fulcrum" />

      <g className="beam-arm" style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${PIVOT_X}px ${BEAM_Y}px` }}>
        <rect x={PIVOT_X - REACH * STEP - 18} y={BEAM_Y - 4} width={REACH * STEP * 2 + 36} height={10} rx={5} className="bar" />
        {PEGS.map((pos) => (
          <g key={pos}>
            <line x1={PIVOT_X + pos * STEP} x2={PIVOT_X + pos * STEP} y1={BEAM_Y + 6} y2={BEAM_Y + 13} className="tick" />
            <text x={PIVOT_X + pos * STEP} y={BEAM_Y + 24} className="tick-label" textAnchor="middle">
              {Math.abs(pos)}
            </text>
          </g>
        ))}
        <g transform={`translate(${PIVOT_X} ${BEAM_Y - 10})`}>
          <rect x={-12} y={-5} width={24} height={10} rx={5} className="vial" />
          <circle cx={bubble} cy={0} r={3.5} className="bubble" />
        </g>
        <circle cx={PIVOT_X} cy={BEAM_Y + 1} r={4} className="pin" />

        {weights.map((wt) => (
          <g
            key={wt.key}
            transform={`translate(${PIVOT_X + wt.pos * STEP} ${BEAM_Y - 4})`}
            className={`placed ${wt.fixed ? '' : 'movable'} ${wt.fresh ? 'drop' : ''}`}
            onClick={wt.fixed || !onWeight ? undefined : () => onWeight(wt.key)}
            role={wt.fixed ? undefined : 'button'}
            aria-label={wt.fixed ? `Fixed weight ${wt.w} at ${Math.abs(wt.pos)} ${wt.pos < 0 ? 'left' : 'right'}` : `Pick up weight ${wt.w}`}
          >
            <WeightShape w={wt.w} fixed={wt.fixed} />
          </g>
        ))}

        {onPeg &&
          PEGS.filter((p) => !weights.some((w) => w.pos === p)).map((pos) => (
            <rect
              key={`hit${pos}`}
              x={PIVOT_X + pos * STEP - STEP / 2}
              y={BEAM_Y - 70}
              width={STEP}
              height={100}
              className={`peg-hit ${armed ? 'armed' : ''}`}
              onClick={() => onPeg(pos)}
              role="button"
              aria-label={`Place on ${Math.abs(pos)} ${pos < 0 ? 'left' : 'right'}`}
            />
          ))}
      </g>
    </svg>
  );
};

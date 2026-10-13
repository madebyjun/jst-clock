import json, sys, statistics as st
from collections import Counter

def load(p):
    return [json.loads(l) for l in open(p) if l.strip()]

def q(xs, p):
    xs = sorted(xs); return xs[min(len(xs) - 1, int(p * len(xs)))] if xs else float('nan')

for path in sys.argv[1:]:
    lo, hi = (int(x) for x in path.split('@')[1].split('-')) if '@' in path else (0, 10**9)
    path = path.split('@')[0]
    fr = [f for f in load(path) if 'd' in f and lo <= f['frame'] <= hi]
    path = f'{path} frames {lo}-{hi}' if hi < 10**9 else path
    print(f'## {path}: {len(fr)} frames with strip read')
    cs = [[f['contrast'][r] for f in fr] for r in range(4)]
    print('contrast per row (median, p5, p95):', [(round(st.median(c)), round(q(c, .05)), round(q(c, .95))) for c in cs])
    # per-bit |d| distribution, row 0 by bit position from LSB
    for r in range(4):
        line = []
        for b in range(16):
            vals = [abs(f['d'][r][15 - b]) for f in fr]
            line.append(f'{b}:{st.median(vals):.2f}/{q(vals, .1):.2f}')
        print(f'row{r} |d| median/p10 by bit (LSB=0):', ' '.join(line))
    for thr in (0.6, 0.5, 0.4):
        k = Counter()
        lowest = 0
        positions = Counter()
        for f in fr:
            m = [b for b in range(16) if abs(f['d'][0][15 - b]) < thr]
            k[len(m)] += 1
            for b in m: positions[b] += 1
            if m and m == list(range(len(m))): lowest += 1
            elif m and max(m) < 8 and m == list(range(min(m), max(m) + 1)): pass
        print(f'row0 mixed (<{thr}) count histogram:', dict(sorted(k.items())), 'positions:', dict(sorted(positions.items())), 'frames where mixed bits are exactly the lowest consecutive bits:', lowest)
        # rows 1-3 uncertain bits
        k2 = Counter()
        for f in fr:
            k2[sum(1 for r in (1, 2, 3) for b in range(16) if abs(f['d'][r][b]) < thr)] += 1
        print(f'rows1-3 bits <{thr} histogram:', dict(sorted(k2.items())))
    # max mixed bit position
    mx = Counter()
    for f in fr:
        m = [b for b in range(16) if abs(f['d'][0][15 - b]) < 0.6]
        mx[max(m) if m else -1] += 1
    print('row0 highest mixed bit position:', dict(sorted(mx.items())))
    print()

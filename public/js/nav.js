// 격자 위의 A* 길찾기. 책상 사이 통로를 따라 걷게 한다.
const CELL = 0.25;
const INFLATE = 0.28;

export class Nav {
  constructor(obstacles, bounds) {
    this.bounds = bounds;
    this.w = Math.ceil((bounds.maxX - bounds.minX) / CELL) + 1;
    this.h = Math.ceil((bounds.maxZ - bounds.minZ) / CELL) + 1;
    this.blocked = new Uint8Array(this.w * this.h);
    for (let j = 0; j < this.h; j++) {
      for (let i = 0; i < this.w; i++) {
        const x = bounds.minX + i * CELL;
        const z = bounds.minZ + j * CELL;
        if (obstacles.some((o) => x > o.minX - INFLATE && x < o.maxX + INFLATE && z > o.minZ - INFLATE && z < o.maxZ + INFLATE)) {
          this.blocked[j * this.w + i] = 1;
        }
      }
    }
  }

  cell(x, z) {
    const i = Math.max(0, Math.min(this.w - 1, Math.round((x - this.bounds.minX) / CELL)));
    const j = Math.max(0, Math.min(this.h - 1, Math.round((z - this.bounds.minZ) / CELL)));
    return [i, j];
  }

  isFree(x, z) {
    if (x < this.bounds.minX || x > this.bounds.maxX || z < this.bounds.minZ || z > this.bounds.maxZ) return false;
    const [i, j] = this.cell(x, z);
    return !this.blocked[j * this.w + i];
  }

  nearestFree(i, j) {
    if (!this.blocked[j * this.w + i]) return [i, j];
    for (let r = 1; r < Math.max(this.w, this.h); r++) {
      let best = null;
      let bestD = Infinity;
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const a = i + di;
          const b = j + dj;
          if (a < 0 || b < 0 || a >= this.w || b >= this.h || this.blocked[b * this.w + a]) continue;
          const d = di * di + dj * dj;
          if (d < bestD) { bestD = d; best = [a, b]; }
        }
      }
      if (best) return best;
    }
    return [i, j];
  }

  lineFree(ax, az, bx, bz) {
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / (CELL * 0.5));
    for (let s = 0; s <= steps; s++) {
      const t = steps ? s / steps : 0;
      if (!this.isFree(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  }

  find(fromX, fromZ, toX, toZ) {
    const start = this.nearestFree(...this.cell(fromX, fromZ));
    const goal = this.nearestFree(...this.cell(toX, toZ));
    const { w, h, bounds } = this;
    const startKey = start[1] * w + start[0];
    const goalKey = goal[1] * w + goal[0];
    const g = new Float32Array(w * h).fill(Infinity);
    const prev = new Int32Array(w * h).fill(-1);
    const closed = new Uint8Array(w * h);
    const open = [startKey];
    const f = new Float32Array(w * h).fill(Infinity);
    const heuristic = (key) => Math.hypot(key % w - goal[0], Math.floor(key / w) - goal[1]);
    g[startKey] = 0;
    f[startKey] = heuristic(startKey);

    while (open.length) {
      let bestIndex = 0;
      for (let k = 1; k < open.length; k++) if (f[open[k]] < f[open[bestIndex]]) bestIndex = k;
      const current = open[bestIndex];
      open[bestIndex] = open[open.length - 1];
      open.pop();
      if (current === goalKey) break;
      if (closed[current]) continue;
      closed[current] = 1;
      const ci = current % w;
      const cj = Math.floor(current / w);
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = ci + di;
          const nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
          const key = nj * w + ni;
          if (this.blocked[key] || closed[key]) continue;
          if (di && dj && (this.blocked[cj * w + ni] || this.blocked[nj * w + ci])) continue;
          const cost = g[current] + (di && dj ? Math.SQRT2 : 1);
          if (cost < g[key]) {
            g[key] = cost;
            prev[key] = current;
            f[key] = cost + heuristic(key);
            open.push(key);
          }
        }
      }
    }

    if (prev[goalKey] === -1 && goalKey !== startKey) return [];
    const raw = [];
    for (let key = goalKey; key !== -1; key = prev[key]) {
      raw.push({ x: bounds.minX + (key % w) * CELL, z: bounds.minZ + Math.floor(key / w) * CELL });
    }
    raw.reverse();

    // 실제 클릭 지점이 비어 있으면 끝점으로 쓴다.
    if (this.isFree(toX, toZ)) raw[raw.length - 1] = { x: toX, z: toZ };

    // 시야가 트인 구간은 곧게 잇는다.
    const smooth = [];
    let anchor = { x: fromX, z: fromZ };
    let i = 0;
    while (i < raw.length) {
      let j = raw.length - 1;
      while (j > i && !this.lineFree(anchor.x, anchor.z, raw[j].x, raw[j].z)) j--;
      smooth.push(raw[j]);
      anchor = raw[j];
      i = j + 1;
    }
    return smooth;
  }
}

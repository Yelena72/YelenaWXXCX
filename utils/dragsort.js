// utils/dragsort.js —— 长按拖动排序用的几个小工具
// 待办 / 想学技能 / 兴趣爱好 三个页面共用的算法都放在这里。

// 把 list 里 from 位置的元素挪到 to 位置（返回新数组，不动原来的）
function moveTo(list, from, to) {
  const out = list.slice()
  if (from < 0 || from >= out.length) return out
  if (to < 0 || to >= out.length) return out
  if (from === to) return out

  const item = out.splice(from, 1)[0]
  out.splice(to, 0, item)
  return out
}

// 在一堆格子里，找离 (x, y) 最近的那个 → 拖动时用来判断「现在要插到第几格」
function nearest(rects, x, y) {
  let best = 0
  let bestDist = 1e18

  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const dist = (cx - x) * (cx - x) + (cy - y) * (cy - y)

    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
  }

  return best
}

module.exports = {
  moveTo: moveTo,
  nearest: nearest
}

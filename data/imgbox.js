/* data/imgbox.js —— 按图片真实比例算显示框
 *
 * 以前配图区是固定高度 + aspectFill，竖构图或超宽的照片会被裁掉一块。
 * 现在改成：框的高度按图片自己的比例算，框和图片比例一致就不裁了。
 *
 * 极端尺寸（特别长 / 特别扁）会超出合理高度，这时候改用 aspectFit 留边，
 * 保证「一定能看全」，只是两边有空白。
 */

// 配图区宽度（rpx）：750 - 页面左右边距 56 - 卡片边框 12 = 682
const MEDIA_W = 682

// 默认（没有图片尺寸信息时）用的高度
const DEFAULT_H = 341

// 太矮（超宽全景）改成 aspectFit 留白
const MIN_H = 160

/**
 * @param {number} imgW 原图宽（px）
 * @param {number} imgH 原图高（px）
 * @param {number} maxH 这个位置最多允许多高（rpx）
 * @returns {{height: number, mode: string}}
 */
function mediaBox(imgW, imgH, maxH) {
  const w = Number(imgW) || 0
  const h = Number(imgH) || 0
  const top = Number(maxH) || 880

  // 老数据没有尺寸信息，退回原来的固定高度
  if (!w || !h) {
    return { height: DEFAULT_H, mode: 'aspectFill' }
  }

  let boxH = MEDIA_W * (h / w)
  let mode = 'aspectFill'

  if (boxH > top) {
    boxH = top
    mode = 'aspectFit'
  } else if (boxH < MIN_H) {
    boxH = MIN_H
    mode = 'aspectFit'
  }

  return { height: Math.round(boxH), mode: mode }
}

/**
 * 补全一张图片的宽高（老数据没有 imgW / imgH 时用）
 * @param {string} src 本地文件路径
 * @param {function} cb (width, height) —— 失败时给 (0, 0)
 */
function getSize(src, cb) {
  if (!src) {
    cb(0, 0)
    return
  }

  wx.getImageInfo({
    src: src,
    success(res) {
      cb(res.width || 0, res.height || 0)
    },
    fail() {
      cb(0, 0)
    }
  })
}

module.exports = {
  mediaBox: mediaBox,
  getSize: getSize,
  MEDIA_W: MEDIA_W,
  DEFAULT_H: DEFAULT_H
}

// 云函数：getMessages —— 读留言
// 按时间倒序，一次 20 条。
// 顺便算好：是不是我发的、我点没点赞、回复列表

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const PAGE_SIZE = 20

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const myOpenid = wxContext.OPENID
  const skip = Number(event.skip) || 0

  try {
    const res = await db
      .collection('messages')
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(PAGE_SIZE)
      .get()

    const list = []

    for (let i = 0; i < res.data.length; i++) {
      const m = res.data[i]
      const likes = m.likes || []
      const rawReplies = m.replies || []

      const replies = []
      for (let k = 0; k < rawReplies.length; k++) {
        const r = rawReplies[k]
        replies.push({
          id: r.id,
          nick: r.nick,
          content: r.content,
          createdAt: r.createdAt
        })
      }

      list.push({
        _id: m._id,
        nick: m.nick,
        content: m.content,
        createdAt: m.createdAt,
        mine: m.openid === myOpenid,
        likeCount: likes.length,
        liked: likes.indexOf(myOpenid) >= 0,
        replies: replies
      })
    }

    return {
      ok: true,
      list: list,
      hasMore: res.data.length === PAGE_SIZE
    }
  } catch (e) {
    // 集合还不存在（一条留言都没有）= 空列表，不算错误。
    // 不然刚开通云开发的环境，第一次进来会直接弹「读取失败」。
    const msg = String((e && (e.errMsg || e.message)) || '')
    const code = e && Number(e.errCode)

    if (code === -502005 || msg.indexOf('not exist') >= 0 || msg.indexOf('NOT_EXIST') >= 0) {
      return { ok: true, list: [], hasMore: false }
    }

    return { ok: false, msg: '读取失败，稍后再试', err: String(e) }
  }
}

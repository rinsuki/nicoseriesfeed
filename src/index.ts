import { Axios } from "axios"
import { App } from "piyo"
import z from "zod"

const { APP_URL, CONTACT_URL } = z
    .object({
        APP_URL: z.string(),
        CONTACT_URL: z.string(),
    })
    .parse(process.env)

const client = new Axios({
    headers: {
        "User-Agent": `nicoseriesfeed/1.0 (+${APP_URL})`,
    },
})

const app = new App()

app.get("/", ctx => {
    ctx.type = "text"
    ctx.body = "Usage: /series/:id/jsonfeed\nContact: Please check " + CONTACT_URL
})

app.get("/series/:id/jsonfeed", async ctx => {
    const { id } = ctx.params

    if (typeof id !== "string") throw ctx.throw(400)
    if (!/^[0-9]{1,8}$/.test(id)) throw ctx.throw(400)

    const res = await client.get<unknown>(`https://nvapi.nicovideo.jp/v2/series/${id}`, {
        params: {
            page: "1",
            pageSize: "500",
        },
        responseType: "json",
        headers: {
            "X-Frontend-Id": "6",
            "X-Frontend-Version": "0",
        },
    })

    const { data } = z
        .object({
            data: z.object({
                detail: z.object({
                    title: z.string(),
                    thumbnailUrl: z.string(),
                }),
                items: z.array(
                    z.object({
                        meta: z.object({
                            id: z.string(),
                        }),
                        video: z.object({
                            id: z.string(),
                            title: z.string(),
                            registeredAt: z.string(),
                            thumbnail: z.object({
                                nHdUrl: z.string(),
                            }),
                            shortDescription: z.string(),
                        }),
                    }),
                ),
            }),
        })
        .parse(res.data)

    ctx.set("Cache-Control", `max-age=${1 * 60 * 60}, public`)

    ctx.body = {
        version: "https://jsonfeed.org/version/1.1",
        title: data.detail.title,
        home_page_url: "https://www.nicovideo.jp/series/" + id,
        icon: data.detail.thumbnailUrl,
        items: data.items.map(item => {
            const url = `https://www.nicovideo.jp/watch/${item.video.id}?ref=thirdparty_nicoseriesfeed`

            return {
                id: item.meta.id,
                url,
                title: item.video.title,
                content_html: `<a href="${url}"><img src="${item.video.thumbnail.nHdUrl}" style="width: 100%; aspect-ratio: 16 / 9;"></a><p>${item.video.shortDescription}…</p>`,
                image: item.video.thumbnail.nHdUrl,
                date_published: item.video.registeredAt,
            }
        }),
    }
})

app.listen(process.env.PORT ?? 3000, () => {
    console.log("listening on http://localhost:3000")
})

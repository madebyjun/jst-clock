export default {
	fetch(request) {
		const url = new URL(request.url);
		if (url.pathname !== "/api/time") {
			return new Response("Not found", { status: 404 });
		}
		// Workers の Date.now() はリクエスト到着時点で固定され I/O まで進まないが、ここでは I/O 前に読むので到着時刻そのものになる
		const t = Date.now();
		return Response.json(
			{ t, colo: request.cf?.colo ?? null },
			{
				headers: {
					"Cache-Control": "no-store",
					"Timing-Allow-Origin": "*",
				},
			},
		);
	},
} satisfies ExportedHandler;

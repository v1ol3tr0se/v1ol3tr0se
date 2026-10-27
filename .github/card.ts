import { writeFileSync } from "node:fs";

type Commit = { committedDate: string; author: { user: { login: string } | null } };
type Repo = {
	name: string;
	languages: { totalSize: number; edges: { size: number; node: { name: string } }[] };
	defaultBranchRef: { target: { history?: { nodes: Commit[] } } } | null;
};

const FONT: Record<string, string> = {
	a: ".... .... .##. ...# .### #..# .###",
	b: "#... #... ###. #..# #..# #..# ###.",
	c: ".... .... .### #... #... #... .###",
	d: "...# ...# .### #..# #..# #..# .###",
	e: ".... .... .##. #..# #### #... .###",
	f: ".## #.. ### #.. #.. #.. #..",
	g: ".... .... .### #..# #..# #..# .### ...# .##.",
	h: "#... #... ###. #..# #..# #..# #..#",
	i: "# . # # # # #",
	j: ".# .. .# .# .# .# .# .# #.",
	k: "#... #... #..# #.#. ##.. #.#. #..#",
	l: "#. #. #. #. #. #. .#",
	m: "..... ..... ####. #.#.# #.#.# #.#.# #.#.#",
	n: ".... .... ###. #..# #..# #..# #..#",
	o: ".... .... .##. #..# #..# #..# .##.",
	p: ".... .... ###. #..# #..# #..# ###. #... #...",
	q: ".... .... .### #..# #..# #..# .### ...# ...#",
	r: ".... .... #.## ##.. #... #... #...",
	s: ".... .... .### #... .##. ...# ###.",
	t: ".#. .#. ### .#. .#. .#. ..#",
	u: ".... .... #..# #..# #..# #..# .###",
	v: "..... ..... #...# #...# .#.#. .#.#. ..#..",
	w: "..... ..... #...# #...# #.#.# #.#.# .#.#.",
	x: "..... ..... #...# .#.#. ..#.. .#.#. #...#",
	y: ".... .... #..# #..# #..# #..# .### ...# .##.",
	z: ".... .... #### ...# .##. #... ####",
	0: ".##. #..# #..# #..# #..# #..# .##.",
	1: ".#. ##. .#. .#. .#. .#. ###",
	2: ".##. #..# ...# ..#. .#.. #... ####",
	3: "###. ...# ...# .##. ...# ...# ###.",
	4: "#..# #..# #..# #### ...# ...# ...#",
	5: "#### #... #... ###. ...# ...# ###.",
	6: ".##. #... #... ###. #..# #..# .##.",
	7: "#### ...# ...# ..#. .#.. .#.. .#..",
	8: ".##. #..# #..# .##. #..# #..# .##.",
	9: ".##. #..# #..# .### ...# ...# .##.",
	" ": "... ... ... ... ... ... ...",
	".": ". . . . . . #",
	"-": "... ... ... ... ### ... ...",
	_: ".... .... .... .... .... .... .... ####",
	"%": "##..# ##.#. ...#. ..#.. .#... .#.## #..##",
	"#": ".#.#. .#.#. ##### .#.#. ##### .#.#. .#.#.",
	">": "... ... #.. .#. ..# .#. #..",
	"+": "... ... ... .#. ### .#. ...",
	"?": ".##. #..# ...# ..#. .#.. .... .#..",
};

const C = {
	edge: "#2a1f3d",
	frame: "#4a3f62",
	sky: "#2a2339",
	off: "#3d2e59",
	label: "#9b8ac4",
	text: "#e0d5e2",
	dim: "#8e7a9a",
	peach: "#efcbc1",
	star: "#fefefe",
};
const RANK = [C.peach, "#b3a3d9", "#9b8ac4", "#8e6c8a"];
const DAY = 864e5;

async function load(): Promise<{ login: string; repos: Repo[] }> {
	const token = process.env.CARD_TOKEN;
	if (!token) throw new Error("CARD_TOKEN is not set");
	const query = `query($since: GitTimestamp!) { viewer { login repositories(first: 100, ownerAffiliations: OWNER, isFork: false, orderBy: {field: PUSHED_AT, direction: DESC}) { nodes { name languages(first: 10, orderBy: {field: SIZE, direction: DESC}) { totalSize edges { size node { name } } } defaultBranchRef { target { ... on Commit { history(since: $since, first: 100) { nodes { committedDate author { user { login } } } } } } } } } } }`;
	const res = await fetch("https://api.github.com/graphql", {
		method: "POST",
		headers: { authorization: `bearer ${token}` },
		body: JSON.stringify({ query, variables: { since: new Date(Date.now() - 8 * DAY).toISOString() } }),
	});
	const body = await res.json();
	if (!res.ok || body.errors)
		throw new Error(`github said ${res.status} ${JSON.stringify(body.errors ?? body.message)}`);
	return { login: body.data.viewer.login, repos: body.data.viewer.repositories.nodes };
}

const { login, repos } = await load();
const day = (d: Date) => d.toLocaleDateString("en-CA");
const today = new Date();
const days = Array.from(
	{ length: 7 },
	(_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + i, 12),
);
const perDay = new Map(days.map((d) => [day(d), 0]));
const perRepo = repos.map((r) => {
	const mine = (r.defaultBranchRef?.target.history?.nodes ?? []).filter((c) => c.author.user?.login === login);
	let week = 0;
	for (const c of mine) {
		const k = day(new Date(c.committedDate));
		if (perDay.has(k)) {
			perDay.set(k, (perDay.get(k) ?? 0) + 1);
			week++;
		}
	}
	return { name: r.name.toLowerCase(), week };
});
const counts = [...perDay.values()];
const total = counts.reduce((a, b) => a + b, 0);
const busiest = Math.max(1, ...counts);

const share = new Map<string, number>();
const weekly = total > 0;
repos.forEach((r, i) => {
	const weight = weekly ? perRepo[i].week : 1;
	if (!weight || !r.languages.totalSize) return;
	for (const e of r.languages.edges)
		share.set(e.node.name, (share.get(e.node.name) ?? 0) + (e.size / r.languages.totalSize) * weight);
});
const shareSum = [...share.values()].reduce((a, b) => a + b, 0) || 1;
const langs = [...share]
	.sort((a, b) => b[1] - a[1])
	.slice(0, 4)
	.map(([name, v]) => ({ name: name.toLowerCase(), pct: Math.round((v / shareSum) * 100) }));

const now = perRepo
	.filter((r) => r.name !== login.toLowerCase())
	.sort((a, b) => b.week - a.week)
	.slice(0, 3);

const layers = new Map<string, string>();
const box = (x: number, y: number, w: number, h: number, fill: string) =>
	layers.set(fill, `${layers.get(fill) ?? ""}M${x} ${y}h${w}v${h}h-${w}z`);
const glyph = (ch: string) => (FONT[ch] ?? FONT["?"]).split(" ");
const measure = (s: string) => [...s].reduce((w, ch) => w + glyph(ch)[0].length + 1, -1);
function text(s: string, x: number, y: number, fill: string) {
	for (const ch of s) {
		const rows = glyph(ch);
		rows.forEach((row, dy) => {
			for (const m of row.matchAll(/#+/g)) box(x + (m.index ?? 0), y + dy, m[0].length, 1, fill);
		});
		x += rows[0].length + 1;
	}
	return x;
}

const P = 12;
const TOP = 36;
const ROW = 12;
const ax = P;
text("this week", ax, TOP, C.label);
days.forEach((d, i) => {
	const x = ax + i * 8;
	const lit = Math.ceil((counts[i] / busiest) * 7);
	for (let t = 0; t < 7; t++) box(x, TOP + 38 - t * 4, 5, 3, t < lit ? (i === 6 ? C.peach : C.label) : C.off);
	const letter = "smtwtfs"[d.getDay()];
	text(letter, x + Math.floor((5 - measure(letter)) / 2), TOP + 43, i === 6 ? C.peach : C.dim);
});
text(`${total} commit${total === 1 ? "" : "s"}`, ax, TOP + 58, C.text);

const bx = ax + 53 + 22;
const nameW = Math.max(...langs.map((l) => measure(l.name)));
text("mostly writing", bx, TOP, C.label);
let pctEnd = 0;
langs.forEach((l, i) => {
	const y = TOP + 14 + i * ROW;
	text(l.name, bx, y, C.text);
	const lit = Math.max(1, Math.round(l.pct / 10));
	for (let t = 0; t < 10; t++) box(bx + nameW + 6 + t * 4, y + 2, 3, 5, t < lit ? RANK[i] : C.off);
	pctEnd = Math.max(pctEnd, text(`${l.pct}%`, bx + nameW + 6 + 40 + 4, y, C.dim));
});

const cx = pctEnd + 20;
text("poking at", cx, TOP, C.label);
const countX = cx + 8 + Math.max(...now.map((r) => measure(r.name))) + 10;
let cursor = { x: 0, y: 0 };
now.forEach((r, i) => {
	const y = TOP + 14 + i * ROW;
	text(">", cx, y, i === 0 ? C.peach : C.dim);
	const end = text(r.name, cx + 6, y, i === 0 ? C.text : C.dim);
	if (i === 0) cursor = { x: end + 1, y: y + 2 };
	if (r.week) text(String(r.week), countX, y, C.dim);
});

const W = Math.max(countX + 12, cx + 70) + P;
const H = TOP + 58 + 9 + P;

const heading = "what kept me up";
const titleStart = Math.round((W - measure(heading)) / 2);
text(heading, titleStart, 13, C.text);
const titleEnd = titleStart + measure(heading);
const stars: [number, number, boolean][] = [
	[titleStart - 18, 9, true],
	[titleStart - 44, 17, false],
	[titleEnd + 16, 9, true],
	[titleEnd + 40, 17, false],
	[W * 0.45, 25, true],
	[W * 0.58, 26, false],
	[W * 0.7, 18, false],
	[W - 26, 9, true],
	[W - 46, 20, false],
	[W - 30, H - 22, true],
	[W - 58, H - 14, false],
	[W - 16, H - 12, false],
	[P + 6, 7, false],
	[P + 28, 14, true],
	[P + 56, 6, false],
	[P + 84, 19, false],
	[titleEnd + 66, 7, false],
	[W - 72, 14, false],
	[W - 10, 21, false],
	[W * 0.33, H - 12, false],
	[W * 0.41, H - 8, true],
	[W * 0.48, H - 9, false],
	[W * 0.56, H - 17, false],
	[W * 0.63, H - 8, true],
	[W - 84, H - 33, false],
	[W - 44, H - 40, false],
	[W - 18, H - 30, true],
	[P + 82, H - 10, false],
];
const twinkles = stars
	.map(([x, y, big], i) => {
		const sx = Math.round(x);
		const d = big ? `M${sx} ${y - 1}h1v3h-1zM${sx - 1} ${y}h3v1h-3z` : `M${sx} ${y}h1v1h-1z`;
		return `<path class="tw" style="animation-delay:-${(i * 1.7) % 5}s" fill="${big ? C.star : i % 3 ? C.text : C.dim}" d="${d}"/>`;
	})
	.join("");

const lanes: [number, number][] = [
	[0.08, 4],
	[0.2, 3],
	[0.34, 10],
	[0.62, 4],
	[0.74, 16],
	[0.28, H - 18],
	[0.5, H - 20],
];
let seed = Number(day(today).replaceAll("-", ""));
const pick = () => {
	seed = (seed * 1103515245 + 12345) % 2147483648;
	return seed / 2147483648;
};
const shooting = lanes
	.map((lane) => ({ lane, k: pick() }))
	.sort((a, b) => a.k - b.k)
	.slice(0, 4)
	.map(({ lane: [fx, y] }, i) => {
		const x = Math.round(W * fx);
		return `<path class="shoot" style="animation-delay:${i * 11 + Math.round(pick() * 6)}s" fill="${C.star}" d="M${x} ${y + 2}h2v1h-2zM${x - 3} ${y + 1}h3v1h-3zM${x - 7} ${y}h4v1h-4z"/>`;
	})
	.join("");

const frame = [C.edge, C.frame, C.sky]
	.map(
		(fill, i) =>
			`<path fill="${fill}" d="M${i + 1} ${i}h${W - 2 - 2 * i}v1h1v${H - 2 - 2 * i}h-1v1h-${W - 2 - 2 * i}v-1h-1v-${H - 2 - 2 * i}h1z"/>`,
	)
	.join("");
const title = `${total} commits this week, mostly ${langs[0]?.name ?? "nothing"}, poking at ${now.map((r) => r.name).join(", ")}`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 2}" height="${H * 2}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges" role="img"><title>${title}</title><style>.tw{animation:tw 5s ease-in-out infinite}.cur{animation:cur 1.2s steps(1) infinite}.shoot{opacity:0;animation:shoot 44s linear infinite}@keyframes shoot{0%,1%{opacity:0;transform:translate(0,0)}2%{opacity:1}5%,100%{opacity:0;transform:translate(46px,14px)}}@keyframes tw{50%{opacity:.15}}@keyframes cur{50%{opacity:0}}@media (prefers-reduced-motion:reduce){.tw,.cur{animation:none}.shoot{display:none}}</style>${frame}${[...layers].map(([fill, d]) => `<path fill="${fill}" d="${d}"/>`).join("")}${twinkles}${shooting}<path class="cur" fill="${C.peach}" d="M${cursor.x} ${cursor.y}h3v5h-3z"/></svg>`;
writeFileSync(process.argv[2] ?? "night.svg", svg);

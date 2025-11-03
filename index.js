/**
 * Notifier
 * ---------------------------------------------
 *
 * Program za dohvaćanje i agregaciju obavijesti
 *
 * ✅ Podrška za obavijesti s više predmeta (svaki s vlastitim Discord webhookom)
 * ✅ Automatsko ponovno logiranje na stranicu ako sesija istekne
 * ✅ Sinkronizacija kolačića (tough-cookie)
 * ✅ Detekcija i podrška za /login/Compound login
 * ✅ Stabilno parsiranje obavijesti (različite strukture)
 * ✅ Rate limit obrada pri slanju poruka na Discord
 *
 * Autor: Mario Olčar
 * Verzija: 2.1 (Compound login + sinkronizirani cookiejar)
 */

import axios from "axios";
import { CookieJar } from "tough-cookie";
import { wrapper } from "axios-cookiejar-support";
import * as cheerio from "cheerio";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

/* ==========================================
    KONFIGURACIJA
========================================== */
const SUBJECTS = JSON.parse(fs.readFileSync("./config/subjects.json", "utf8"));
const ENDPOINTS = JSON.parse(
	fs.readFileSync("./config/endpoints.json", "utf8")
);

const username = process.env.USERNAME;
const password = process.env.PASSWORD;
const website = process.env.WEBSITE;

const DATA_DIR = "./data";
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

/* ==========================================
    AXIOS + COOKIEJAR SETUP
========================================== */
const jar = new CookieJar();
const client = wrapper(
	axios.create({
		jar,
		withCredentials: true,
		maxRedirects: 10, // važno za SSO redirecte
		validateStatus: (s) => s >= 200 && s < 400,
	})
);

let lastLogin = null;

/* ==========================================
    POMOĆNE FUNKCIJE
========================================== */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function syncCookiesBetweenDomains(from, to) {
	const cookies = await jar.getCookies(from);
	for (const cookie of cookies) {
		const newCookie = cookie.clone();
		newCookie.domain = new URL(to).hostname;
		await jar.setCookie(newCookie.toString(), to);
	}
}

/* ==========================================
    LOGIN FUNKCIJE
========================================== */
async function login() {
	try {
		console.log("🔑 Prijava...");

		const loginPage = await client.get(ENDPOINTS.loginPage);
		const $ = cheerio.load(loginPage.data);
		const token = $('input[name="csrfmiddlewaretoken"]').val();

		await client.post(
			ENDPOINTS.loginAction,
			new URLSearchParams({ username, password, csrfmiddlewaretoken: token }),
			{ headers: { "Content-Type": "application/x-www-form-urlencoded" } }
		);

		await syncCookiesBetweenDomains(ENDPOINTS.loginPage, ENDPOINTS.baseSite);

		lastLogin = new Date();
		console.log(`✅ Uspješno prijavljen (${lastLogin.toLocaleTimeString()})`);
	} catch (err) {
		console.error("❌ Greška pri prijavi:", err.message);
	}
}

async function loginCompound(fromUrl) {
	try {
		console.log("🔑 Prijava putem Compound logina...");

		const loginUrl = `${
			ENDPOINTS.baseSite
		}/login/Compound?frompage=${encodeURIComponent(
			fromUrl
		)}&return=${encodeURIComponent(fromUrl)}`;

		const page = await client.get(loginUrl);
		const $ = cheerio.load(page.data);

		const token = $('input[name="csrfmiddlewaretoken"]').val() || "";
		const formAction = $("form").attr("action");
		const fullAction = formAction.startsWith("http")
			? formAction
			: new URL(formAction, ENDPOINTS.baseSite).href;

		await client.post(
			fullAction,
			new URLSearchParams({
				username,
				password,
				csrfmiddlewaretoken: token,
			}),
			{ headers: { "Content-Type": "application/x-www-form-urlencoded" } }
		);

		await syncCookiesBetweenDomains(ENDPOINTS.loginPage, ENDPOINTS.baseSite);

		lastLogin = new Date();
		console.log(
			`✅ Uspješno prijavljen putem Compound (${lastLogin.toLocaleTimeString()})`
		);
	} catch (err) {
		console.error("❌ Greška pri Compound prijavi:", err.message);
	}
}

async function ensureLoggedIn() {
	const now = new Date();
	const elapsed = lastLogin ? (now - lastLogin) / 1000 / 60 : Infinity;
	if (elapsed > 60) {
		console.log("🔄 Ponovni login (sesija starija od 1h)...");
		await login();
	}
}

/* ==========================================
    PARSIRANJE OBAVIJESTI
========================================== */
async function getObavijesti(url) {
	await ensureLoggedIn();

	const res = await client.get(url);
	const $ = cheerio.load(res.data);

	// Ako smo završili na Compound loginu
	if (res.request.res.responseUrl?.includes("/login/Compound")) {
		console.warn(
			"⚠️ Detektiran Compound login – pokušavam dodatnu autentikaciju..."
		);
		await loginCompound(url);
		const retryRes = await client.get(url);
		return parseObavijesti(cheerio.load(retryRes.data), url);
	}

	// Ako smo završili na login stranici → sesija istekla
	if (
		$("form#login-form").length > 0 ||
		$("title").text().includes("Prijava")
	) {
		console.warn("⚠️ Sesija istekla! Ponovni login...");
		await login();
		const retryRes = await client.get(url);
		return parseObavijesti(cheerio.load(retryRes.data), url);
	}

	return parseObavijesti($, url);
}

function parseObavijesti($, predmetNaziv = "") {
	const obavijesti = [];
	let struktura = null;

	if ($(".news_article").length > 0) struktura = ".news_article";
	else if ($(".news_list_item").length > 0) struktura = ".news_list_item";
	else if ($(".newsItem, .news-item").length > 0)
		struktura = ".newsItem, .news-item";
	else {
		console.warn(`⚠️ [${predmetNaziv}] Nije prepoznata struktura obavijesti.`);
		return [];
	}

	console.log(`🔎 [${predmetNaziv}] Koristim selektor: ${struktura}`);

	$(struktura).each((_, el) => {
		const element = $(el);

		let naslov =
			element.find(".news_title h1 a").text().trim() ||
			element.find(".news_title h1").text().trim() ||
			element.find(".title a").text().trim() ||
			element.find(".title").text().trim() ||
			element.find("h1, h2, strong").first().text().trim();

		let datum =
			element.find("time").attr("datetime") ||
			element.find(".news_pub_date time").attr("datetime") ||
			element.find(".date, .news_date").text().trim() ||
			"";
		datum = datum.replace(/CET|CEST/g, "").trim();

		let autor =
			element.find(".author_name").text().trim() ||
			element.find(".author span").last().text().trim() ||
			element.find(".author").text().replace("Autor:", "").trim() ||
			"Nepoznato";

		let link =
			element.find(".news_title h1 a").attr("href") ||
			element.find(".title a").attr("href") ||
			element.find("a").first().attr("href") ||
			null;
		if (link && link.startsWith("/")) link = `${website}${link}`;
		if (naslov) obavijesti.push({ naslov, datum, autor, link });
	});

	if (obavijesti.length === 0)
		console.warn(
			`⚠️ [${predmetNaziv}] Nema obavijesti – struktura se možda promijenila.`
		);

	return obavijesti;
}

/* ==========================================
    POHRANA STARIH OBAVIJESTI
========================================== */
function loadOldObavijesti(predmet) {
	const file = path.join(DATA_DIR, `obavijesti_${predmet}.json`);
	if (!fs.existsSync(file)) return [];
	try {
		return JSON.parse(fs.readFileSync(file, "utf8"));
	} catch {
		return [];
	}
}

function saveObavijesti(predmet, obavijesti) {
	const file = path.join(DATA_DIR, `obavijesti_${predmet}.json`);
	fs.writeFileSync(file, JSON.stringify(obavijesti, null, 2));
}

/* ==========================================
    DISCORD SLANJE (S RATE LIMITOM)
========================================== */
const messageQueue = [];
let sending = false;

async function queueDiscordMessage(predmet, obavijest, link, webhook) {
	messageQueue.push({ predmet, obavijest, link, webhook });
	if (!sending) processQueue();
}

async function processQueue() {
	sending = true;

	while (messageQueue.length > 0) {
		const { predmet, obavijest, link, webhook } = messageQueue.shift();
		try {
			await sendDiscordMessage(predmet, obavijest, link, webhook);
			await sleep(1200);
		} catch (err) {
			console.error(`⚠️ Greška pri slanju poruke:`, err.message);
			await sleep(5000);
		}
	}

	sending = false;
}

async function sendDiscordMessage(predmet, obavijest, link, webhook) {
	try {
		await axios.post(webhook, {
			content: `📢 Nova obavijest za **${predmet.toUpperCase()}**\n**${
				obavijest.naslov
			}**\n👤 ${obavijest.autor}\n📅 ${obavijest.datum}\n🔗 ${link}`,
		});
		console.log(`📨 Poslana obavijest za ${predmet}: ${obavijest.naslov}`);
	} catch (err) {
		if (err.response?.status === 429) {
			const retryAfter = err.response.data?.retry_after
				? err.response.data.retry_after * 1000
				: 5000;
			console.warn(`🚦 Rate limit – čekam ${retryAfter / 1000}s...`);
			await sleep(retryAfter);
			return sendDiscordMessage(predmet, obavijest, link, webhook);
		}
		throw err;
	}
}

/* ==========================================
    GLAVNA PETLJA
========================================== */
async function checkAllSubjects() {
	console.log("\n🔍 Provjera obavijesti za sve predmete...");

	for (const { naziv, url, webhook } of SUBJECTS) {
		try {
			const nove = await getObavijesti(url);
			const stare = loadOldObavijesti(naziv);

			const noveObavijesti = nove.filter(
				(o) => !stare.some((s) => s.naslov === o.naslov && s.datum === o.datum)
			);

			if (noveObavijesti.length > 0) {
				console.log(`🆕 ${naziv}: ${noveObavijesti.length} novih obavijesti`);
				for (const ob of noveObavijesti) {
					await queueDiscordMessage(naziv, ob, url, webhook);
				}
				saveObavijesti(naziv, nove);
			} else {
				console.log(`📭 ${naziv}: Nema novih obavijesti`);
			}
		} catch (err) {
			console.error(`❌ Greška kod predmeta ${naziv}:`, err.message);
		}
	}
}

/* ==========================================
    START
========================================== */
(async () => {
	await login();
	await checkAllSubjects();
	setInterval(checkAllSubjects, 5 * 60 * 1000);
})();

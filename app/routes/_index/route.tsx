import type { LinksFunction, LoaderFunctionArgs, MetaFunction } from "react-router";
import { useEffect, useRef, useState } from "react";
import { redirect, useNavigate } from "react-router";
import { AiLogo } from "../../components/AiLogos";
import { AI_ASSISTANTS, aboutPrompt, aiChatUrl } from "../../lib/ai-help";
import { FAQ, landingJsonLd, landingMeta } from "../../lib/site-content";

import {
  APP_STORE_URL,
  CONTACT_EMAIL,
  DEMO_STORE_PASSWORD,
  DEMO_STORE_URL,
  ICON,
  PublicLayout,
  SITE_URL,
  primaryCta,
  publicLinks,
  publicStyles as s,
} from "../../components/PublicLayout";

// perks.tofoapp.com: the public landing page. Inside the Shopify admin it hands straight over to the app.

export const links: LinksFunction = () => [
  ...publicLinks(),
  { rel: "alternate", type: "text/plain", href: "/llms.txt", title: "Employee Perks guide for AI assistants" },
  { rel: "preload", as: "image", href: "/site/0-feature.jpg" },
];

export const meta: MetaFunction = () => landingMeta(SITE_URL);

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const p = url.searchParams;
  // Opened from the Shopify admin (embedded iframe): go straight to the app, never the landing page.
  const embedded =
    p.get("shop") ||
    p.get("host") ||
    p.get("embedded") ||
    p.get("id_token") ||
    request.headers.get("sec-fetch-dest") === "iframe";
  if (embedded) {
    throw redirect(`/app?${p.toString()}`);
  }
  return null;
};

/** Simple line icons (24px grid, stroke = currentColor). */
const PATHS = {
  key: "M15 7a4 4 0 1 1-3.9 4.9L4 19v-3h3v-3h3l1.1-1.1A4 4 0 0 1 15 7Zm1.5 2.5h.01",
  tag: "M3 12V4h8l9.3 9.3a1 1 0 0 1 0 1.4l-6.6 6.6a1 1 0 0 1-1.4 0L3 12Zm4.5-4.5h.01",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  gauge: "M4 15a8 8 0 1 1 16 0M12 15l4-5M3 19h18",
  page: "M4 5h16v14H4zM4 9h16M8 13h3M8 16h6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0",
  shirt: "M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0Z",
  mail: "M3 5h18v14H3zM3 6l9 7 9-7",
} as const;
function Icon({ name }: { name: keyof typeof PATHS }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Shopify's bag mark (simple-icons, brand green), used only to say the app is made for Shopify. */
function ShopifyBag({ color = "#95BF47" }: { color?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d="M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.73c-.018-.116-.114-.192-.211-.192s-1.929-.136-1.929-.136-1.275-1.274-1.439-1.411c-.045-.037-.075-.057-.121-.074l-.914 21.104h.023zM11.71 11.305s-.81-.424-1.774-.424c-1.447 0-1.504.906-1.504 1.141 0 1.232 3.24 1.715 3.24 4.629 0 2.295-1.44 3.76-3.406 3.76-2.354 0-3.54-1.465-3.54-1.465l.646-2.086s1.245 1.066 2.28 1.066c.675 0 .975-.545.975-.932 0-1.619-2.654-1.694-2.654-4.359-.034-2.237 1.571-4.416 4.827-4.416 1.257 0 1.875.361 1.875.361l-.945 2.715-.02.01zM11.17.83c.136 0 .271.038.405.135-.984.465-2.064 1.639-2.508 3.992-.656.213-1.293.405-1.889.578C7.697 3.75 8.951.84 11.17.84V.83zm1.235 2.949v.135c-.754.232-1.583.484-2.394.736.466-1.777 1.333-2.645 2.085-2.971.193.501.309 1.176.309 2.1zm.539-2.234c.694.074 1.141.867 1.429 1.755-.349.114-.735.231-1.158.366v-.252c0-.752-.096-1.371-.271-1.871v.002zm2.992 1.289c-.02 0-.06.021-.078.021s-.289.075-.714.21c-.423-1.233-1.176-2.37-2.508-2.37h-.115C12.135.209 11.669 0 11.265 0 8.159 0 6.675 3.877 6.21 5.846c-1.194.365-2.063.636-2.16.674-.675.213-.694.232-.772.87-.075.462-1.83 14.063-1.83 14.063L15.009 24l.927-21.166z" />
    </svg>
  );
}

const ARROW_L = "M15 5l-7 7 7 7";
const ARROW_R = "M9 5l7 7-7 7";
const CLOSE = "M6 6l12 12M18 6 6 18";
function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** The App Store listing's feature image, then its six screenshots. */
const SHOTS = [
  { file: "0-feature", alt: "Partner employees get their own price on a product page, with the discount at checkout" },
  { file: "1-add-company", alt: "Adding a partner company with its work email domain" },
  { file: "2-discount-limit", alt: "Setting a 15% discount and a monthly limit per employee" },
  { file: "3-checkout", alt: "Employee price on a product page and the discount at checkout" },
  { file: "4-employee-price", alt: "Employee prices and hidden products, with live previews" },
  { file: "5-invoices", alt: "Monthly invoices per company with PDF and Excel files" },
  { file: "6-perks-page", alt: "A perks page on the store listing partner companies" },
];

/** Full-screen slideshow: arrows, Esc to close, ←/→ keys. */
function Slideshow({ start, onClose }: { start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const n = SHOTS.length;
  const go = (d: number) => setI((x) => (x + d + n) % n);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((x) => (x + 1) % n);
      if (e.key === "ArrowLeft") setI((x) => (x - 1 + n) % n);
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [n, onClose]);
  return (
    <div className={s.lightbox} role="dialog" aria-modal="true" aria-label="Screenshots">
      <div className={s.lbTop}>
        <span>{i + 1} / {n}</span>
        <button type="button" className={s.lbBtn} onClick={onClose} aria-label="Close"><Glyph d={CLOSE} /></button>
      </div>
      <div className={s.lbStage}>
        <button type="button" className={s.lbBtn} onClick={() => go(-1)} aria-label="Previous"><Glyph d={ARROW_L} /></button>
        <img className={s.lbImg} src={`/site/${SHOTS[i].file}.jpg`} alt={SHOTS[i].alt} width={1600} height={900} />
        <button type="button" className={s.lbBtn} onClick={() => go(1)} aria-label="Next"><Glyph d={ARROW_R} /></button>
      </div>
      <p className={s.lbCap}>{SHOTS[i].alt}</p>
    </div>
  );
}

/** Like the App Store: one big image and three small ones; the last says "+N more". Any of them opens the slideshow. */
function Gallery() {
  const [open, setOpen] = useState<number | null>(null);
  const rest = SHOTS.length - 4;
  return (
    <div className={s.gallery}>
      <button type="button" className={s.slideBtn} onClick={() => setOpen(0)} aria-label="Open screenshots">
        <img className={s.shot} src={`/site/${SHOTS[0].file}.jpg`} alt={SHOTS[0].alt} width={1600} height={900} fetchPriority="high" />
      </button>
      <div className={s.thumbs}>
        {[1, 2, 3].map((i) => (
          <button key={SHOTS[i].file} type="button" className={s.thumb} onClick={() => setOpen(i)} aria-label={`Open screenshot ${i + 1}: ${SHOTS[i].alt}`}>
            <img src={`/site/${SHOTS[i].file}-sm.jpg`} alt="" width={800} height={450} loading="lazy" />
            {i === 3 && rest > 0 ? <span className={s.more}><span>+{rest} more</span></span> : null}
          </button>
        ))}
      </div>
      {open !== null ? <Slideshow start={open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

/* ---------- Features: a sliding row of picture cards. Hover (or tap) shows the detail. ---------- */

const FEATURES: { title: string; text: string; ui: React.ReactNode }[] = [
  {
    title: "Automatic discount, no codes",
    text: "A customer logged in with a partner's work email gets the discount at checkout by itself. There's no code to share, leak or forget.",
    ui: (
      <>
        <div className={s.fxUser}><span><Icon name="user" /></span>sara@northwind.com</div>
        <div className={s.fxBox}>
          <div className={s.fxRow}><span>Subtotal</span><span>$80.00</span></div>
          <div className={`${s.fxRow} ${s.fxGreen}`}><span>Employee price (15% off)</span><span>−$12.00</span></div>
          <div className={`${s.fxRow} ${s.fxBold}`}><span>Total</span><span>$68.00</span></div>
        </div>
      </>
    ),
  },
  {
    title: "A deal for every partner company",
    text: "Add as many companies as you like. Each gets its own work email domains, a percentage or fixed discount, the products it applies to and its own limit.",
    ui: (
      <div className={s.fxBox}>
        <div className={s.fxRow}><span>Northwind</span><span className={s.fxPill}>15% off</span></div>
        <div className={s.fxRow}><span>Globex</span><span className={s.fxPill}>$10 off</span></div>
        <div className={s.fxRow}><span>Initech</span><span className={s.fxPill}>20% off shoes</span></div>
        <div className={s.fxRow}><span>Your own staff</span><span className={s.fxPill}>30% off</span></div>
      </div>
    ),
  },
  {
    title: "Employee prices in your theme",
    text: "Logged-in employees see their own price on product pages and collections, with the normal price crossed out. Everyone else sees your store as usual.",
    ui: (
      <div className={s.fxProduct}>
        <div className={s.fxThumb}><Icon name="shirt" /></div>
        <div>
          <div className={s.fxName}>Merino hoodie</div>
          <div className={s.fxStrike}>$80.00</div>
          <div className={s.fxPrice}>$68.00</div>
          <div className={s.fxSmall}>Your employee price · 15% off</div>
        </div>
      </div>
    ),
  },
  {
    title: "Products only employees can buy",
    text: "Pick products, collections, vendors or types for employees only. They're hidden from other shoppers in your theme and blocked for them at checkout.",
    ui: (
      <div className={s.fxBox}>
        <div className={s.fxRow}><span>Staff uniform, size M</span><span>$70.00</span></div>
        <div className={s.fxNote}><Icon name="lock" />Only for partner employees. Log in with your work email to buy it.</div>
      </div>
    ),
  },
  {
    title: "Limits per employee",
    text: "Cap the discount or the spend for each employee every month or every year. The order that reaches the limit gets what's left, then full price until it resets.",
    ui: (
      <div className={s.fxBox}>
        <div className={s.fxRow}><span className={s.fxMuted}>November limit</span><span>$100 of discount</span></div>
        <div className={s.fxBar}><span style={{ width: "94%" }} /></div>
        <div className={s.fxRow}><span className={s.fxMuted}>Used</span><span>$94.00</span></div>
        <div className={`${s.fxRow} ${s.fxGreen}`}><span>Left this month</span><span>$6.00</span></div>
      </div>
    ),
  },
  {
    title: "Monthly invoices per company",
    text: "One invoice per company each month, kept up to date as orders are fulfilled or cancelled. Bill for the discount given or what employees spent, as PDF or Excel.",
    ui: (
      <div className={s.fxBox}>
        <div className={`${s.fxRow} ${s.fxBold}`}><span>INV-202611-001</span><span className={s.fxMuted}>Northwind · Nov</span></div>
        <div className={s.fxRow}><span className={s.fxMuted}>s•••@northwind.com</span><span>$25.00</span></div>
        <div className={s.fxRow}><span className={s.fxMuted}>a•••@northwind.com</span><span>$6.00</span></div>
        <div className={`${s.fxRow} ${s.fxBold}`}><span>Due</span><span>$31.00</span></div>
        <div className={s.fxChips}><span>PDF</span><span>Excel</span></div>
      </div>
    ),
  },
  {
    title: "Every employee in one list",
    text: "See who gets perks, their company, orders, spend and how much of their limit they've used. Search, filter, export to Excel, and remove anyone in one click.",
    ui: (
      <div className={s.fxBox}>
        <div className={s.fxRow}><span>sara@northwind.com</span><span className={s.fxPill}>Active</span></div>
        <div className={s.fxRow}><span>omar@globex.io</span><span className={s.fxMuted}>At limit</span></div>
        <div className={s.fxRow}><span>li@initech.co</span><span className={s.fxPill}>Active</span></div>
        <div className={s.fxChips}><span>Export to Excel</span></div>
      </div>
    ),
  },
  {
    title: "A perks page on your store",
    text: "One page in your own theme listing your partner companies and what their employees get, so they know to shop with you. On or off in one click.",
    ui: (
      <div className={s.fxBox}>
        <div className={`${s.fxRow} ${s.fxBold}`}><span>yourstore.com/apps/perks</span></div>
        <div className={s.fxRow}><span>Northwind</span><span className={s.fxPill}>15% off</span></div>
        <div className={s.fxRow}><span>Globex</span><span className={s.fxPill}>$10 off</span></div>
        <div className={s.fxCta}>Log in with your work email</div>
      </div>
    ),
  },
  {
    title: "Know why, in one click",
    text: "Type any customer's email to see whether they get perks, from which company, and the exact fix if they don't. Every change is in the activity log.",
    ui: (
      <div className={s.fxBox}>
        <div className={s.fxRow}><span className={s.fxGreen}>✓ Account found</span></div>
        <div className={s.fxRow}><span className={s.fxGreen}>✓ Matched to Northwind</span></div>
        <div className={s.fxRow}><span className={s.fxGreen}>✓ Within the monthly limit</span></div>
        <div className={s.fxRow}><span className={s.fxBold}>Gets 15% off</span></div>
      </div>
    ),
  },
];

function Features() {
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const update = () => {
    const el = track.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 });
  };
  useEffect(update, []);
  const slide = (dir: number) => {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };
  return (
    <section className={s.secWide} id="features" aria-labelledby="features-title">
      <div className={s.secHead}>
        <div>
          <h2 className={s.secTitle} id="features-title">Features</h2>
          <p className={s.secSub}>Every feature is included in every plan. Hover or tap a card for the details.</p>
        </div>
        <div className={s.arrows}>
          <button type="button" onClick={() => slide(-1)} disabled={edge.start} aria-label="Previous features"><Glyph d={ARROW_L} /></button>
          <button type="button" onClick={() => slide(1)} disabled={edge.end} aria-label="More features"><Glyph d={ARROW_R} /></button>
        </div>
      </div>
      <div className={s.fxTrack} ref={track} onScroll={update}>
        {FEATURES.map((f) => (
          // Focusable so keyboard and touch users can reveal the detail (screen readers read it anyway).
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          <article key={f.title} className={s.fx} tabIndex={0}>
            <div className={s.fxArt} aria-hidden="true"><div className={s.fxUi}>{f.ui}</div></div>
            <h3 className={s.fxTitle}>{f.title}</h3>
            <div className={s.fxOver}>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ---------- How it works: five steps, plays by itself until someone picks one. ---------- */

const HOW = [
  {
    title: "Add a partner company",
    text: "Its name, work email domain and discount. About a minute.",
    ui: (
      <>
        <p className={s.uiH}>Add business</p>
        <div className={s.uiLabel}>Company name</div>
        <div className={s.uiField}>Northwind</div>
        <div className={s.uiLabel}>Work email domains</div>
        <div className={s.uiField}><span className={s.uiChip}>northwind.com</span></div>
        <div className={s.uiLabel}>Discount</div>
        <div className={s.uiField}>15% off all products · up to $100 a month</div>
        <span className={s.uiBtn}>Create business</span>
      </>
    ),
  },
  {
    title: "Switch it on",
    text: "Turn on perks in Settings and Employee mode in your theme. No code.",
    ui: (
      <>
        <p className={s.uiH}>Settings</p>
        <div className={s.uiRow}><span>Employee perks</span><span className={s.toggle} aria-hidden="true"><i /></span></div>
        <p className={s.uiH} style={{ marginTop: 14 }}>Theme editor · App embeds</p>
        <div className={s.uiRow}><span>Employee mode</span><span className={s.toggle} aria-hidden="true"><i /></span></div>
        <span className={s.uiBtn}>Save</span>
      </>
    ),
  },
  {
    title: "Employees log in with their work email",
    text: "Shopify emails them a login code, which proves the email is theirs.",
    ui: (
      <>
        <p className={s.uiH}>Log in to your store</p>
        <div className={s.uiField}>sara@northwind.com</div>
        <div className={s.uiLabel}>Enter the code sent to sara@northwind.com</div>
        <div className={s.code}>{["4", "8", "1", "9", "2", "6"].map((d, i) => <span key={i}>{d}</span>)}</div>
        <span className={s.uiBtn}>Log in</span>
      </>
    ),
  },
  {
    title: "They see their price, and pay it",
    text: "On product pages, in collections and at checkout. Nothing to type.",
    ui: (
      <>
        <div className={s.fxProduct}>
          <div className={s.fxThumb}><Icon name="shirt" /></div>
          <div>
            <div className={s.fxName}>Merino hoodie</div>
            <div className={s.fxStrike}>$80.00</div>
            <div className={s.fxPrice}>$68.00</div>
          </div>
        </div>
        <div className={`${s.uiRow} ${s.uiSave}`} style={{ marginTop: 12 }}><span>Employee price (15% off)</span><span>−$12.00</span></div>
      </>
    ),
  },
  {
    title: "Bill the company, if it pays",
    text: "A monthly invoice for the discount or the spend, as PDF and Excel.",
    ui: (
      <>
        <p className={s.uiH}>INV-202611-001 <span className={`${s.uiBadge} ${s.uiBadgeGrey}`}>Northwind · Nov 2026</span></p>
        <div className={s.uiRow}><span className={s.uiMuted}>Employees</span><span>2</span></div>
        <div className={s.uiRow}><span className={s.uiMuted}>Orders fulfilled</span><span>4</span></div>
        <div className={s.uiRow} style={{ fontWeight: 700 }}><span>Amount due</span><span>$31.00</span></div>
        <span className={s.uiBtn}>Download PDF · Excel</span>
      </>
    ),
  },
];

function HowItWorks() {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setI((x) => (x + 1) % HOW.length), 4500);
    return () => clearTimeout(t);
  }, [i, auto]);
  return (
    <div className={s.how}>
      <ol className={s.howSteps}>
        {HOW.map((h, n) => (
          <li key={h.title}>
            <button
              type="button"
              className={s.howStep}
              aria-pressed={i === n}
              onClick={() => {
                setAuto(false);
                setI(n);
              }}
            >
              <i>{n + 1}</i>
              <div>
                <b>{h.title}</b>
                <span>{h.text}</span>
              </div>
              {i === n && auto ? <em key={i} className={s.howProgress} aria-hidden="true" /> : null}
            </button>
          </li>
        ))}
      </ol>
      <div className={s.howView}>
        <div key={i} className={`${s.slideUi} ${s.howFade}`}>{HOW[i].ui}</div>
      </div>
    </div>
  );
}

/** "Ask your AI about it": pick an assistant, see the prompt, then open it there or copy it. */
function AskAi() {
  const [ai, setAi] = useState<(typeof AI_ASSISTANTS)[number]["id"]>("claude");
  const [copied, setCopied] = useState(false);
  const prompt = aboutPrompt(`${SITE_URL}/llms.txt`);
  const name = AI_ASSISTANTS.find((a) => a.id === ai)?.name;
  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the prompt is on screen to select */
    }
  }
  return (
    <div className={s.ai}>
      <div className={s.aiHead}>
        <span className={s.aiStack} aria-hidden="true">
          {AI_ASSISTANTS.map((a) => (
            <span key={a.id}><AiLogo assistant={a.id} size={14} /></span>
          ))}
        </span>
        Ask your AI about it
      </div>
      <div className={s.aiTabs} role="group" aria-label="Assistant">
        {AI_ASSISTANTS.map((a) => (
          <button key={a.id} type="button" aria-pressed={ai === a.id} onClick={() => setAi(a.id)}>
            <AiLogo assistant={a.id} size={15} />
            {a.name}
          </button>
        ))}
      </div>
      <p className={s.aiPrompt}>{prompt}</p>
      <div className={s.aiActions}>
        <button type="button" className={s.aiCopy} onClick={copy}>{copied ? "Copied" : "Copy prompt"}</button>
        <a className={s.aiOpen} href={aiChatUrl(ai, prompt)} target="_blank" rel="noreferrer">Open in {name} ↗</a>
      </div>
    </div>
  );
}

function CopyText({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={s.copyBtn}
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          /* clipboard blocked: the text is on screen */
        }
      }}
    >
      {done ? <Icon name="check" /> : <Icon name="copy" />}
    </button>
  );
}

/** Install button. Until the App Store listing is live, it opens a short note with how to get the app now. */
function Install() {
  const cta = primaryCta("site_card");
  const [open, setOpen] = useState(false);
  if (APP_STORE_URL)
    return (
      <a className={`${s.btn} ${s.btnPrimary}`} href={cta.href}>
        <ShopifyBag />
        {cta.label}
      </a>
    );
  return (
    <>
      <button type="button" className={`${s.btn} ${s.btnPrimary}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <ShopifyBag />
        Install on Shopify
      </button>
      {open ? (
        <div className={s.installNote} id="install">
          <b>Arriving on the Shopify App Store soon.</b> Shopify is reviewing it now. Email us and we&apos;ll let you
          know the day it&apos;s live, and help you set it up. Meanwhile, try the demo store below.
          <a className={s.installMail} href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Tell me when Employee Perks is live")}`}>
            <Icon name="mail" />
            {CONTACT_EMAIL}
          </a>
        </div>
      ) : null}
    </>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  // Inside the Shopify admin (e.g. the app title link), always show the app, never this page.
  useEffect(() => {
    if (window.top !== window.self) navigate(`/app${window.location.search}`, { replace: true });
  }, [navigate]);

  return (
    <PublicLayout home>
      {landingJsonLd(SITE_URL).map((data, n) => (
        <script key={n} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
      ))}
      <main className={`${s.wrap} ${s.layout}`}>
        <aside className={s.card}>
          <div className={s.appHead}>
            <img className={s.appIcon} src={ICON} alt="Employee Perks app icon" width={64} height={64} />
            <div>
              <h1 className={s.appName}>Employee Perks</h1>
              <span className={s.forShopify}><ShopifyBag />An app for Shopify</span>
            </div>
          </div>
          <dl className={s.dl}>
            <div><dt>Pricing</dt><dd>From $9/month · 30-day free trial</dd></div>
            <div><dt>Works with</dt><dd>Every Shopify plan</dd></div>
            <div>
              <dt>Developer</dt>
              <dd><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></dd>
            </div>
          </dl>
          <div className={s.cardCta}>
            <Install />
            {DEMO_STORE_URL ? (
              <div className={s.demoBox}>
                <a className={s.textLink} href={DEMO_STORE_URL} target="_blank" rel="noreferrer">
                  <ShopifyBag color="currentColor" />View demo store ↗
                </a>
                <div className={s.demoPass}>
                  Store password <code>{DEMO_STORE_PASSWORD}</code>
                  <CopyText text={DEMO_STORE_PASSWORD} label="Copy the demo store password" />
                </div>
              </div>
            ) : null}
          </div>
          <AskAi />
        </aside>

        <div className={s.content}>
          <Gallery />

          <div className={s.intro}>
            <h2 className={s.introTitle}>
              Employee discounts for Shopify: turn partner companies into steady customers. Their employees get your
              discount automatically, and you never hand out a code.
            </h2>
            <p>
              Agree a deal with a company, add its work email domain, and you&apos;re live. Its employees log in to
              your store with their work email, see their own price while they shop, and the discount applies at
              checkout. Only real employees get it: Shopify&apos;s login code proves the email is theirs.
            </p>
            <ul className={s.bullets}>
              <li><Icon name="check" /><span><b>Win corporate deals.</b> Give each company its own discount, products and limit.</span></li>
              <li><Icon name="check" /><span><b>Stop discount abuse.</b> No codes to leak; the discount only works for logged-in employees.</span></li>
              <li><Icon name="check" /><span><b>Get paid by the company.</b> A monthly invoice per company, as PDF and Excel.</span></li>
              <li><Icon name="check" /><span><b>No admin.</b> Employees join by logging in. Remove anyone in one click.</span></li>
              <li><Icon name="check" /><span><b>Set up in minutes.</b> Works with your theme in one click, on every Shopify plan.</span></li>
            </ul>
            <p className={s.willTitle}>Your store will:</p>
            <div className={s.will}>
              <div><span className={s.willIcon}><Icon name="tag" /></span>Show employee prices to employees</div>
              <div><span className={s.willIcon}><Icon name="lock" /></span>Sell products only employees can buy</div>
              <div><span className={s.willIcon}><Icon name="page" /></span>Have a perks page for your partners</div>
              <div><span className={s.willIcon}><Icon name="gauge" /></span>Limit discounts per month or year</div>
            </div>
          </div>

          <Features />

          <section className={s.secWide} id="how" aria-labelledby="how-title">
            <div className={s.secHead}>
              <div>
                <h2 className={s.secTitle} id="how-title">How it works</h2>
                <p className={s.secSub}>From install to the first employee order in a few minutes.</p>
              </div>
            </div>
            <HowItWorks />
          </section>

          <section className={s.secWide} id="pricing" aria-labelledby="pricing-title">
            <h2 className={s.srOnly} id="pricing-title">Pricing</h2>
            <div className={s.pricing}>
              <div className={s.plans}>
                {[
                  { name: "Basic", price: 9, year: 90, for: "For stores on Shopify Basic or Starter" },
                  { name: "Standard", price: 19, year: 190, for: "For stores on Grow, Advanced or Plus" },
                ].map((p) => (
                  <div key={p.name} className={s.plan}>
                    <div className={s.planTop}>
                      <p className={s.planName}>{p.name}</p>
                      <span className={s.planTrial}>30-day free trial</span>
                    </div>
                    <p className={s.planPrice}>${p.price} <small>/ month</small></p>
                    <p className={s.planNote}>or ${p.year}/year, 2 months free · {p.for}</p>
                    <ul className={s.planList}>
                      <li><Icon name="check" />Unlimited partner companies and employees</li>
                      <li><Icon name="check" />Automatic discounts and employee prices</li>
                      <li><Icon name="check" />Employee-only products and limits</li>
                      <li><Icon name="check" />Monthly invoices, reports and Excel exports</li>
                      <li><Icon name="check" />Email support from the developer</li>
                    </ul>
                  </div>
                ))}
              </div>
              <p className={`${s.small} ${s.pricingNote}`}>
                Billed by Shopify on your Shopify invoice; cancel any time. Your price is set by the Shopify plan you
                have when you subscribe, and upgrading Shopify later keeps it. Free on development stores.
              </p>
            </div>
          </section>

          <section className={`${s.sec} ${s.faq}`} id="faq">
            <div>
              <h2 className={s.secTitle}>Questions</h2>
              <p className={s.secSub}>
                Something else? <a href={`mailto:${CONTACT_EMAIL}`}>Email us</a>.
              </p>
            </div>
            <div>
              {FAQ.map(([q, a]) => (
                <details key={q}><summary>{q}</summary><p>{a}</p></details>
              ))}
            </div>
          </section>

          <section className={s.sec} id="support">
            <div><h2 className={s.secTitle}>Support</h2><p className={s.secSub}>From the developer, by email.</p></div>
            <div>
              <div className={s.kv}>
                <span>Email</span>
                <span className={s.kvList}>
                  <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                  <small>Questions, help setting up, or a feature you need: we reply fast and often ship requests in days.</small>
                </span>
              </div>
              <div className={s.kv}>
                <span>Resources</span>
                <span className={s.kvList}>
                  <a href="/privacy">Privacy policy</a>
                  <a href="/terms">Terms of service</a>
                  <a href="/llms.txt">Guide for AI assistants</a>
                </span>
              </div>
              <div className={s.kv}>
                <span>Works with</span>
                <span>Checkout, Online Store themes, customer accounts, Shopify Functions</span>
              </div>
              <div className={s.kv}>
                <span>Data access</span>
                <span>
                  Customer ID, account email (to match the company) and orders with the employee discount (for limits
                  and invoices). No payment details. Data is never sold, and is deleted 48 hours after uninstall.
                  <small><a href="/privacy">Read the privacy policy</a></small>
                </span>
              </div>
            </div>
          </section>
        </div>
      </main>
    </PublicLayout>
  );
}

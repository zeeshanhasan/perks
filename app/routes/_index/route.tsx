import type {
  LinksFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from "react-router";
import { useEffect, useState } from "react";
import { redirect, useNavigate } from "react-router";
import { AiLogo } from "../../components/AiLogos";
import { AI_ASSISTANTS, aboutPrompt, aiChatUrl } from "../../lib/ai-help";

import {
  CONTACT_EMAIL,
  ICON,
  earlyAccessMail,
  DEMO_STORE_URL,
  PublicLayout,
  SITE_URL,
  primaryCta,
  publicLinks,
  publicStyles as s,
} from "../../components/PublicLayout";

// perks.tofoapp.com: the public landing page. Inside the Shopify admin it hands straight over to the app.

const TITLE = "Employee Perks: employee discounts for Shopify stores";
const DESCRIPTION =
  "Give partner companies' employees automatic discounts, employee prices and employee-only products in your Shopify store. They log in with their work email; the discount applies at checkout.";

export const links: LinksFunction = publicLinks;

export const meta: MetaFunction = () => [
  { title: TITLE },
  { name: "description", content: DESCRIPTION },
  { tagName: "link", rel: "canonical", href: `${SITE_URL}/` },
  { property: "og:type", content: "website" },
  { property: "og:url", content: `${SITE_URL}/` },
  { property: "og:title", content: TITLE },
  { property: "og:description", content: DESCRIPTION },
  { property: "og:site_name", content: "Employee Perks" },
  { property: "og:image", content: `${SITE_URL}${ICON}` },
  { name: "twitter:card", content: "summary" },
  { name: "twitter:title", content: TITLE },
  { name: "twitter:description", content: DESCRIPTION },
];

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
  file: "M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5",
  page: "M4 5h16v14H4zM4 9h16M8 13h3M8 16h6",
  users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a6 6 0 0 1 3.5 6",
  share: "M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.6 13.5l6.8 4M15.4 6.5l-6.8 4",
  mail: "M3 5h18v14H3zM3 6l9 7 9-7",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9Z",
  shield: "M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6l8-3Z",
  doc: "M7 3h7l4 4v14H7zM14 3v4h4",
  eyeOff: "M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a16 16 0 0 1-2.6 3.2M6.5 6.6C4.3 8 3 12 3 12s4 6 9 6c1.4 0 2.7-.4 3.9-1",
  cloud: "M7 18h10a4 4 0 0 0 .6-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18Z",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  store: "M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  next: "M9 5l7 7-7 7",
  bottle: "M8 3h8v4H8zM7 7h10v14H7zM10 12h4M12 10v4",
  star: "M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9l-5.3 2.7 1-5.8-4.2-4.1 5.9-.9L12 3.5Z",
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

/** Gallery slides: simplified views of the real app and storefront. */
const SLIDES: { key: string; title: React.ReactNode; text: string; ui: React.ReactNode }[] = [
  {
    key: "company",
    title: <>Perks for every <em>partner company</em></>,
    text: "Add a company with its work email domain and the discount its employees get.",
    ui: (
      <>
        <p className={s.uiH}>Acme Corporation <span className={s.uiBadge}>Active</span></p>
        <div className={s.uiLabel}>Work email domains</div>
        <div className={s.uiField}><span className={s.uiChip}>acme.com</span><span className={s.uiChip}>acme.pk</span></div>
        <div className={s.uiLabel}>Discount</div>
        <div className={s.uiField}>15% off all products</div>
        <div className={s.uiGreen}>Each employee gets 15% off, up to $100 of discount every month.</div>
      </>
    ),
  },
  {
    key: "price",
    title: <>Employees see <em>their own price</em></>,
    text: "On product pages and collections, in your own theme. Other shoppers see the normal price.",
    ui: (
      <div className={s.uiProduct}>
        <div className={s.uiImg}><Icon name="bottle" /></div>
        <div>
          <div style={{ fontWeight: 600 }}>Vitamin C, 60 tablets</div>
          <div className={s.uiStaff}>Your staff price</div>
          <div><span className={s.uiPrice}>$34.00</span><span className={s.uiStrike}>$40.00</span></div>
          <span className={s.uiBtn}>Add to cart</span>
        </div>
      </div>
    ),
  },
  {
    key: "checkout",
    title: <>The discount applies <em>at checkout</em></>,
    text: "No codes to share or leak. Nothing for employees to remember.",
    ui: (
      <>
        <p className={s.uiH}>Order summary</p>
        <div className={s.uiRow}><span>Subtotal</span><span>$40.00</span></div>
        <div className={`${s.uiRow} ${s.uiSave}`}><span>Employee perks · Acme</span><span>−$6.00</span></div>
        <div className={s.uiRow}><span className={s.uiMuted}>Shipping</span><span className={s.uiMuted}>Free</span></div>
        <div className={s.uiRow} style={{ fontWeight: 700 }}><span>Total</span><span>$34.00</span></div>
      </>
    ),
  },
  {
    key: "invoice",
    title: <>Invoice each <em>company</em></>,
    text: "Per employee and month, as a PDF and an Excel file listing every item.",
    ui: (
      <>
        <p className={s.uiH}>INV-202611-001 <span className={`${s.uiBadge} ${s.uiBadgeGrey}`}>Acme · Nov 2026</span></p>
        <table className={s.uiTable}>
          <thead><tr><th>Employee</th><th className={s.r}>Orders</th><th className={s.r}>Discount</th></tr></thead>
          <tbody>
            <tr><td>s•••@acme.com</td><td className={s.r}>3</td><td className={s.r}>$25.00</td></tr>
            <tr><td>a•••@acme.com</td><td className={s.r}>1</td><td className={s.r}>$6.00</td></tr>
            <tr className={s.uiTotal}><td>Total</td><td className={s.r}>4</td><td className={s.r}>$31.00</td></tr>
          </tbody>
        </table>
      </>
    ),
  },
  {
    key: "only",
    title: <>Products <em>only employees</em> can buy</>,
    text: "Hidden from other shoppers in your theme and blocked for them at checkout.",
    ui: (
      <>
        <p className={s.uiH}>Checkout</p>
        <div className={s.uiRow}><span>Staff uniform, size M</span><span>$70.00</span></div>
        <div className={s.uiError}>Only for employees of our partner companies. Log in with your work email to buy it.</div>
      </>
    ),
  },
  {
    key: "limit",
    title: <>Limits that <em>stop exactly</em> there</>,
    text: "Cap the discount or the spend per employee, every month or every year.",
    ui: (
      <>
        <p className={s.uiH}>Limit per employee</p>
        <div className={s.uiField}>$100 of discount · every month</div>
        <div className={s.uiRow} style={{ marginTop: 8 }}><span className={s.uiMuted}>Used this month</span><span>$94.00</span></div>
        <div className={`${s.uiRow} ${s.uiSave}`}><span>Left for this order</span><span>$6.00</span></div>
        <div className={s.uiGreen}>The last order gets what&apos;s left of the limit, then the discount stops until the 1st.</div>
      </>
    ),
  },
  {
    key: "page",
    title: <>A <em>perks page</em> on your store</>,
    text: "List your partner companies and what their employees get, in your own theme.",
    ui: (
      <>
        <p className={s.uiH}>yourstore.com/apps/perks</p>
        <div className={s.uiRow}><span>Acme Corporation</span><span className={s.uiBadge}>15% off</span></div>
        <div className={s.uiRow}><span>Globex</span><span className={s.uiBadge}>$10 off</span></div>
        <div className={s.uiRow}><span>Initech</span><span className={s.uiBadge}>10% off</span></div>
        <span className={s.uiBtn}>Log in with your work email</span>
      </>
    ),
  },
  {
    key: "check",
    title: <>Know <em>why</em>, in one click</>,
    text: "Check any customer: see if they get perks, and the exact fix if they don't.",
    ui: (
      <>
        <p className={s.uiH}>Check a customer</p>
        <div className={s.uiField}>sara@gmail.com</div>
        <div className={s.uiError}>Logged in with a personal email. Ask Sara to log in with her work email (acme.com).</div>
        <div className={s.uiRow} style={{ marginTop: 6 }}><span className={s.uiMuted}>Company</span><span>Acme Corporation</span></div>
      </>
    ),
  },
];

function Slide({ i }: { i: number }) {
  const sl = SLIDES[i];
  return (
    <div className={s.slide}>
      <div>
        <p className={s.slideTitle}>{sl.title}</p>
        <p className={s.slideText}>{sl.text}</p>
      </div>
      <div className={s.slideUi}>{sl.ui}</div>
    </div>
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

/** Full-screen slideshow: arrows, Esc to close, ←/→ keys. */
function Slideshow({ start, onClose }: { start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const n = SLIDES.length;
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
        <Slide i={i} />
        <button type="button" className={s.lbBtn} onClick={() => go(1)} aria-label="Next"><Glyph d={ARROW_R} /></button>
      </div>
      <p className={s.lbCap}>{SLIDES[i].text}</p>
    </div>
  );
}

/** Like the App Store: one big image and three small ones; the last says "+N more". Any of them opens the slideshow. */
function Gallery() {
  const [open, setOpen] = useState<number | null>(null);
  const rest = SLIDES.length - 4;
  return (
    <div className={s.gallery}>
      <button type="button" className={s.slideBtn} onClick={() => setOpen(0)} aria-label="Open screenshots">
        <Slide i={0} />
      </button>
      <div className={s.thumbs}>
        {[1, 2, 3].map((i) => (
          <button key={SLIDES[i].key} type="button" className={s.thumb} onClick={() => setOpen(i)} aria-label={`Open screenshot ${i + 1}`}>
            <div className={s.thumbInner} aria-hidden="true"><Slide i={i} /></div>
            {i === 3 && rest > 0 ? <span className={s.more}><span>+{rest} more</span></span> : null}
          </button>
        ))}
      </div>
      {open !== null ? <Slideshow start={open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

const FEATURES = [
  ["key", "Automatic perks, no codes", "Customers logged in with an approved work email get the discount at checkout. Codes can't be shared or leaked because there are none.", "Anyone @acme.com gets 15% off"],
  ["users", "A deal for every company", "Each partner company gets its own email domains, a percentage or fixed discount, and the products it applies to.", "Acme 15% on everything, Globex $10 off vitamins"],
  ["tag", "Employee prices in your theme", "Employees see their price on product pages and collections, with the normal price crossed out. Other shoppers see your store as usual.", "$34.00 instead of $40.00"],
  ["lock", "Employee-only products", "Pick products, collections, vendors or types only employees can buy. Other shoppers don't see them and can't check out with them.", "Staff uniforms, bulk packs, internal kits"],
  ["gauge", "Limits per employee", "Cap the discount or the spend for each employee every month or every year. The order that reaches the limit gets what's left.", "Up to $100 of discount a month"],
  ["file", "Reports and invoices", "See each company's orders, employees and discount for any period. Create an invoice with a PDF and an Excel file of every item.", "Bill Acme $31.00 for November"],
  ["page", "A perks page on your store", "One page listing your partner companies and what their employees get, so they know to shop with you. On or off in one click.", "yourstore.com/apps/perks"],
  ["shield", "Answers in one click", "Type any customer's email to see if they get perks, from which company, and the exact fix if they don't. Every change is logged.", "\"Logged in with a personal email\""],
] as const;

/** Interactive "How it works": pick a step, see what it looks like. */
const HOW = [
  {
    title: "You add a partner company",
    text: "Its name, work email domain and the discount. About a minute.",
    ui: (
      <>
        <p className={s.uiH}>Add business</p>
        <div className={s.uiLabel}>Company name</div>
        <div className={s.uiField}>Acme Corporation</div>
        <div className={s.uiLabel}>Work email domains</div>
        <div className={s.uiField}><span className={s.uiChip}>acme.com</span></div>
        <div className={s.uiLabel}>Discount</div>
        <div className={s.uiField}>15% off all products</div>
        <span className={s.uiBtn}>Save</span>
      </>
    ),
  },
  {
    title: "Employees log in with their work email",
    text: "Shopify emails them a login code, which proves the email is theirs.",
    ui: (
      <>
        <p className={s.uiH}>Log in to Your Store</p>
        <div className={s.uiField}>sara@acme.com</div>
        <div className={s.uiLabel}>Enter the code sent to sara@acme.com</div>
        <div className={s.code}>{["4", "8", "1", "9", "2", "6"].map((d, i) => <span key={i}>{d}</span>)}</div>
        <span className={s.uiBtn}>Log in</span>
      </>
    ),
  },
  {
    title: "They see their price and the discount applies",
    text: "On product pages, in the cart and at checkout. Nothing to type.",
    ui: (
      <>
        <div className={s.uiProduct}>
          <div className={s.uiImg}><Icon name="bottle" /></div>
          <div>
            <div style={{ fontWeight: 600 }}>Vitamin C, 60 tablets</div>
            <div className={s.uiStaff}>Your staff price</div>
            <div><span className={s.uiPrice}>$34.00</span><span className={s.uiStrike}>$40.00</span></div>
          </div>
        </div>
        <div className={`${s.uiRow} ${s.uiSave}`} style={{ marginTop: 10 }}><span>Employee perks · Acme</span><span>−$6.00</span></div>
      </>
    ),
  },
  {
    title: "You invoice the company (optional)",
    text: "If the company pays for the perk, a monthly invoice bills it for the discount or the spend.",
    ui: (
      <>
        <p className={s.uiH}>INV-202611-001 <span className={`${s.uiBadge} ${s.uiBadgeGrey}`}>Acme · Nov 2026</span></p>
        <div className={s.uiRow}><span className={s.uiMuted}>Employees</span><span>2</span></div>
        <div className={s.uiRow}><span className={s.uiMuted}>Orders</span><span>4</span></div>
        <div className={s.uiRow} style={{ fontWeight: 700 }}><span>Amount due</span><span>$31.00</span></div>
        <span className={s.uiBtn}>Download PDF + Excel</span>
      </>
    ),
  },
];

function HowItWorks() {
  const [i, setI] = useState(0);
  return (
    <div className={s.how}>
      <ol className={s.howSteps}>
        {HOW.map((h, n) => (
          <li key={h.title}>
            <button type="button" className={s.howStep} aria-pressed={i === n} onClick={() => setI(n)}>
              <i>{n + 1}</i>
              <div><b>{h.title}</b><span>{h.text}</span></div>
            </button>
          </li>
        ))}
      </ol>
      <div className={s.howView}>
        <div className={s.slideUi}>{HOW[i].ui}</div>
        <button type="button" className={s.howNext} onClick={() => setI((i + 1) % HOW.length)}>
          {i === HOW.length - 1 ? "Start again" : "Next step →"}
        </button>
      </div>
    </div>
  );
}

const FAQ = [
  ["Who is it for?", "Shopify stores that sell to employees of partner companies (corporate deals, pharmacies, gyms, B2B partners), or that give their own team a staff discount."],
  ["Can someone get the discount by typing a work email at checkout?", "No. Perks only apply to customers who are logged in, and Shopify's login code proves the work email."],
  ["What if an employee's account uses a personal email?", "Perks need an account with their work email. They log in, or create an account, with their work email. Your store tells them so."],
  ["How much does it cost?", "$9 a month for stores on Shopify's Basic or Starter plan, $19 a month on Grow, Advanced and Plus, after a 30-day free trial. Every feature is included in both, and Shopify bills it on your Shopify invoice. Upgrading Shopify later keeps your price."],
  ["Does it change my theme code?", "No. Employee prices and hidden products come from a theme app embed you switch on in one click. Uninstalling leaves nothing behind."],
] as const;

/** "Start with your AI": pick an assistant, see the prompt, then open it there or copy it. */
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

export default function Landing() {
  const navigate = useNavigate();
  // Inside the Shopify admin (e.g. the app title link), always show the app, never this page.
  useEffect(() => {
    if (window.top !== window.self)
      navigate(`/app${window.location.search}`, { replace: true });
  }, [navigate]);
  const cta = primaryCta("site_card");

  return (
    <PublicLayout home>
      <main className={`${s.wrap} ${s.layout}`}>
        <aside className={s.card}>
          <div className={s.appHead}>
            <img className={s.appIcon} src={ICON} alt="" width={64} height={64} />
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
              <dd><a href="https://tofoapp.com">tofoapp.com</a></dd>
              <dd><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></dd>
            </div>
          </dl>
          <div className={s.cardCta}>
            <a className={`${s.btn} ${s.btnPrimary}`} href={cta.href}><ShopifyBag />Install on Shopify</a>
            <a className={s.textLink} href={DEMO_STORE_URL ?? "#how"} {...(DEMO_STORE_URL ? { target: "_blank", rel: "noreferrer" } : {})}>
              <ShopifyBag color="currentColor" />View demo store
            </a>
          </div>
          <AskAi />
        </aside>

        <div>
          <Gallery />

          <div className={s.intro}>
            <h2 className={s.introTitle}>
              Turn partner companies into steady customers. Their employees get your discount automatically, and
              you never hand out a code.
            </h2>
            <p>
              Agree a deal with a company, add its work email domain, and you&apos;re live. Its employees log in to
              your store with their work email, see their own price while they shop, and the discount applies at
              checkout. Only real employees get it: Shopify&apos;s login code proves the email.
            </p>
            <ul className={s.bullets}>
              <li><Icon name="check" /><span><b>Win corporate deals.</b> Give each company its own discount, products and monthly limit.</span></li>
              <li><Icon name="check" /><span><b>Stop discount abuse.</b> No codes to leak; the discount only works for logged-in employees.</span></li>
              <li><Icon name="check" /><span><b>Get paid by the company.</b> Invoice what its employees bought, as PDF and Excel.</span></li>
              <li><Icon name="check" /><span><b>No admin.</b> Employees join by logging in. Remove anyone in one click.</span></li>
              <li><Icon name="check" /><span><b>Set up in minutes.</b> Works with your theme in one click, on every Shopify plan.</span></li>
            </ul>
            <p className={s.willTitle}>Your store will:</p>
            <div className={s.will}>
              <div><span className={s.featIcon}><Icon name="tag" /></span>Show discounted prices to employees</div>
              <div><span className={s.featIcon}><Icon name="lock" /></span>Sell employee-only products</div>
              <div><span className={s.featIcon}><Icon name="page" /></span>Have a perks page for your partners</div>
              <div><span className={s.featIcon}><Icon name="gauge" /></span>Limit discounts by product, month or year</div>
            </div>
          </div>

          <section className={s.sec} id="features">
            <div><h2 className={s.secTitle}>Features</h2><p className={s.secSub}>Everything is included in every plan.</p></div>
            <div className={s.feats}>
              {FEATURES.map(([icon, title, text, eg]) => (
                <div key={title} className={s.feat}>
                  <div className={s.featIcon}><Icon name={icon} /></div>
                  <div><h3>{title}</h3><p>{text}</p><span className={s.eg}>{eg}</span></div>
                </div>
              ))}
            </div>
          </section>

          <section className={s.sec} id="how">
            <div><h2 className={s.secTitle}>How it works</h2><p className={s.secSub}>Click a step to see it.</p></div>
            <HowItWorks />
          </section>

          <section className={s.sec} id="pricing">
            <div>
              <h2 className={s.secTitle}>Pricing</h2>
              <p className={s.secSub}>Set by your Shopify plan. Every feature in both.</p>
            </div>
            <div>
              <div className={s.plans}>
                <div className={s.plan}>
                  <p className={s.planName}>Basic</p>
                  <p className={s.planPrice}>$9 <small>/ month</small></p>
                  <p className={s.planNote}>For stores on Shopify Basic or Starter · or $90/year</p>
                  <ul className={s.planList}>
                    <li><Icon name="check" />30-day free trial</li>
                    <li><Icon name="check" />Unlimited partner companies and employees</li>
                    <li><Icon name="check" />Every feature, no paid add-ons</li>
                  </ul>
                </div>
                <div className={s.plan}>
                  <p className={s.planName}>Standard</p>
                  <p className={s.planPrice}>$19 <small>/ month</small></p>
                  <p className={s.planNote}>For Grow, Advanced and Plus · or $190/year</p>
                  <ul className={s.planList}>
                    <li><Icon name="check" />30-day free trial</li>
                    <li><Icon name="check" />Unlimited partner companies and employees</li>
                    <li><Icon name="check" />Every feature, no paid add-ons</li>
                  </ul>
                </div>
              </div>
              <div className={`${s.plan} ${s.planHot} ${s.foundingStrip}`}>
                <div>
                  <p className={s.planName}>Founding stores <span className={s.planTag}>First 50</span></p>
                  <p className={s.planNote} style={{ margin: "4px 0 0" }}>
                    Keep your price for life, even when prices go up, plus setup help on a call.
                  </p>
                </div>
                <a className={s.smallBtn} href={earlyAccessMail}>Become a founding store</a>
              </div>
              <p className={s.small} style={{ marginTop: 10 }}>
                Billed by Shopify on your Shopify invoice. Upgrading your Shopify plan keeps your price. Free on
                development stores.
              </p>
            </div>
          </section>

          <section className={s.sec} id="reviews">
            <div><h2 className={s.secTitle}>Reviews</h2></div>
            <div className={s.founding}>
              <div className={s.stars} aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <Icon key={i} name="star" />)}</div>
              <h3>No reviews yet. Be one of the first stores.</h3>
              <p>The first 50 stores keep their price for life and get setup help on a call.</p>
            </div>
          </section>

          <section className={`${s.sec} ${s.faq}`} id="faq">
            <div><h2 className={s.secTitle}>Questions</h2></div>
            <div>
              {FAQ.map(([q, a]) => (
                <details key={q}><summary>{q}</summary><p>{a}</p></details>
              ))}
            </div>
          </section>

          <section className={s.sec} id="support">
            <div><h2 className={s.secTitle}>Support</h2><p className={s.secSub}>App support provided by Tofoapp.</p></div>
            <div>
              <div className={s.kv}>
                <span>Resources</span>
                <span className={s.kvList}>
                  <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                  <a href="/privacy">Privacy policy</a>
                  <a href="/terms">Terms of service</a>
                </span>
              </div>
              <div className={s.kv}>
                <span>Developer</span>
                <span><a href="https://tofoapp.com">Tofoapp</a></span>
              </div>
              <div className={s.kv}>
                <span>Works with</span>
                <span>Checkout, Online Store themes, Customer accounts, Shopify Functions</span>
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

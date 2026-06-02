import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  Layers3,
  ShieldCheck,
  Globe2,
  Workflow,
  BarChart3,
  Smartphone,
  CheckCircle2,
  Mail,
  Menu,
  X,
  Star,
  Zap,
  Building2,
  Rocket,
  Quote,
} from "lucide-react";
import "./styles.css";

const navItems = ["Home", "Work", "Services", "Products", "Process", "Contact"];

const enquiryEmail = "mailto:hello@creovateglobal.com?subject=Project%20enquiry%20for%20Creovate%20Global&body=Hello%20Creovate%20Global%2C%0A%0AI%20would%20like%20to%20make%20a%20project%20enquiry.%0A%0AProject%20type%3A%20Website%20%2F%20dashboard%20%2F%20MVP%20%2F%20business%20system%0AWhat%20I%20need%3A%20%0ATimeline%3A%20%0ABudget%20range%20%28if%20available%29%3A%20%0AName%3A%20%0APhone%20%2F%20WhatsApp%3A%20%0A%0AThank%20you.";
const consultationEmail = "mailto:hello@creovateglobal.com?subject=Book%20a%20consultation%20with%20Creovate%20Global&body=Hello%20Creovate%20Global%2C%0A%0AI%20would%20like%20to%20book%20a%20consultation.%0A%0APreferred%20date%20and%20time%3A%20%0AMy%20project%20or%20business%20idea%3A%20%0AName%3A%20%0APhone%20%2F%20WhatsApp%3A%20%0A%0AThank%20you.";

const products = [
  {
    name: "InvoKitPro",
    status: "Active build",
    title: "Offline-first business toolkit",
    description:
      "Invoices, receipts, clients, items and business records designed for SMEs who need practical tools that still work when internet fails.",
    tag: "SaaS / PWA",
  },
  {
    name: "AfroCraveKitchen",
    status: "Prototype",
    title: "Food ordering experience",
    description:
      "A modern food venture interface built around menu discovery, smooth ordering and local brand trust.",
    tag: "FoodTech",
  },
  {
    name: "BranchLoom",
    status: "Concept phase",
    title: "Microfinance operations layer",
    description:
      "A Nigerian MFB-focused workflow concept for customer records, loan processes, operational visibility and field accountability.",
    tag: "FinOps",
  },
];

const services = [
  {
    icon: <Layers3 />,
    title: "Premium Websites",
    description:
      "Founder-led websites, landing pages and brand systems that look credible enough to win client trust before a meeting starts.",
  },
  {
    icon: <Workflow />,
    title: "Business Systems",
    description:
      "Internal tools, portals, admin dashboards and operational workflows built around how real businesses actually work.",
  },
  {
    icon: <Smartphone />,
    title: "MVP Prototypes",
    description:
      "Clickable product prototypes and launch-ready MVP interfaces for validating ideas, pitching partners and starting lean.",
  },
  {
    icon: <BarChart3 />,
    title: "Dashboards & Data UX",
    description:
      "Business dashboards that turn messy activity into useful decisions, clean visuals and executive-level clarity.",
  },
];

const proof = [
  "UK + Nigeria business context",
  "Founder-led product thinking",
  "Offline-first SME tools",
  "Client conversion-focused design",
];

const process = [
  {
    step: "01",
    title: "Clarify",
    text: "We define the real business problem, the audience, the offer and the decision the website or system must support.",
  },
  {
    step: "02",
    title: "Design",
    text: "We create a premium, trustworthy interface with the right spacing, copy, motion, structure and brand feel.",
  },
  {
    step: "03",
    title: "Build",
    text: "We turn the design into a working product, website or prototype that can be tested, shown and improved quickly.",
  },
  {
    step: "04",
    title: "Launch",
    text: "We prepare the project for deployment, analytics, conversion, ongoing improvements and client presentation.",
  },
];

function FloatingCard({ className, children, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.7, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionHeader({ eyebrow, title, text }) {
  return (
    <div className="section-header">
      <div className="eyebrow amber"><Sparkles />{eyebrow}</div>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

function App() {
  const [open, setOpen] = useState(false);

  return (
    <main>
      <div className="ambient" aria-hidden="true">
        <div className="glow glow-one" />
        <div className="glow glow-two" />
        <div className="glow glow-three" />
      </div>

      <header className="site-header">
        <nav className="nav-wrap">
          <a href="#home" className="brand">
            <div className="brand-mark"><Sparkles /></div>
            <div><strong>Creovate Global</strong><span>Digital Product Studio</span></div>
          </a>

          <div className="desktop-nav">
            {navItems.map((item) => <a key={item} href={`#${item.toLowerCase()}`}>{item}</a>)}
          </div>

          <div className="nav-actions">
            <a href={enquiryEmail} className="btn btn-ghost">Email us</a>
            <a href={enquiryEmail} className="btn btn-light">Start a project <ArrowRight /></a>
          </div>

          <button className="menu-btn" onClick={() => setOpen(!open)} aria-label="Toggle menu">
            {open ? <X /> : <Menu />}
          </button>
        </nav>
        {open && (
          <div className="mobile-nav">
            {navItems.map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`} onClick={() => setOpen(false)}>{item}</a>
            ))}
          </div>
        )}
      </header>

      <section id="home" className="hero container">
        <div className="hero-copy">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="eyebrow cyan">
            <Zap /> Building practical digital products for ambitious businesses
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            Digital systems that look premium and work in the real world.
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            Creovate Global is a founder-led product studio creating websites, dashboards, MVPs and offline-first business tools for SMEs, creators and growing brands.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="hero-actions">
            <a href="#work" className="btn btn-gradient">View our work <ArrowRight /></a>
            <a href="#services" className="btn btn-ghost large">Explore services</a>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="proof-grid">
            {proof.map((item) => <div key={item} className="proof-card"><CheckCircle2 />{item}</div>)}
          </motion.div>
        </div>

        <div className="hero-visual">
          <motion.div animate={{ y: [0, -14, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} className="hero-orb" />
          <FloatingCard delay={0.2} className="floating invoice-card">
            <div className="card-head"><div><span>Current build</span><h3>InvoKitPro</h3></div><b>Active</b></div>
            <div className="mini-dashboard">
              <div className="dash-top"><div><span>Invoice value</span><strong>£2,480</strong></div><BarChart3 /></div>
              <div className="dash-grid">{[["42","Clients"],["118","Receipts"],["76","Items"]].map(([n,l]) => <div key={l}><strong>{n}</strong><span>{l}</span></div>)}</div>
            </div>
          </FloatingCard>
          <FloatingCard delay={0.35} className="floating launch-card">
            <div className="icon-row"><span><Rocket /></span><div><small>Launch-ready thinking</small><strong>From idea to credible MVP</strong></div></div>
            <p>Strategy, UI, copy, prototype, deployment plan and client-facing polish in one practical delivery flow.</p>
          </FloatingCard>
          <FloatingCard delay={0.5} className="floating trust-card">
            <div className="icon-row"><span><ShieldCheck /></span><div><strong>Trust-first design</strong><small>Credible. Clear. Client-loving.</small></div></div>
          </FloatingCard>
        </div>
      </section>

      <section className="stats-band">
        <div className="container stats-grid">
          {[["5+","Active concepts"],["UK + NG","Market context"],["SME-first","Business focus"],["Offline-ready","Product edge"]].map(([number,label]) => <div key={label}><strong>{number}</strong><span>{label}</span></div>)}
        </div>
      </section>

      <section id="work" className="section container">
        <SectionHeader eyebrow="Selected product work" title="Built around real business problems, not just pretty screens." text="Creovate Global combines premium presentation with practical tools: business operations, customer experiences, data visibility and founder-led product strategy." />
        <div className="product-grid">
          {products.map((product, index) => (
            <motion.article key={product.name} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.08 }} className="product-card">
              <div className="mockup"><div className="mock-inner"><div className="mock-top"><span>{product.tag}</span><Sparkles /></div><i></i><i></i><div><b></b><b></b><b></b></div></div></div>
              <div className="product-body"><div><h3>{product.name}</h3><span>{product.status}</span></div><h4>{product.title}</h4><p>{product.description}</p></div>
            </motion.article>
          ))}
        </div>
      </section>

      <section id="services" className="section deep">
        <div className="container split">
          <div className="sticky-copy">
            <div className="eyebrow cyan"><Building2 /> What we build</div>
            <h2>Premium digital delivery for ambitious small businesses.</h2>
            <p>The goal is simple: help businesses look credible, operate smarter and show clients that they are serious.</p>
            <a href={consultationEmail} className="btn btn-light">Book a consultation <ArrowRight /></a>
          </div>
          <div className="service-grid">
            {services.map((service, index) => <motion.div key={service.title} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.08 }} className="service-card"><span>{service.icon}</span><h3>{service.title}</h3><p>{service.description}</p></motion.div>)}
          </div>
        </div>
      </section>

      <section id="products" className="section container">
        <div className="asset-panel">
          <div><div className="pill"><Globe2 /> Product studio advantage</div><h2>We do not just design websites. We shape digital assets.</h2><p>A website should not only be beautiful. It should explain the business, increase trust, guide visitors, support sales and make the founder look prepared.</p></div>
          <div className="check-list">{["Clear offer and positioning","Premium UI direction and motion","Client conversion sections","Case studies and product proof","Deployment-ready structure"].map(item => <div key={item}><CheckCircle2 />{item}</div>)}</div>
        </div>
      </section>

      <section id="process" className="section deep">
        <SectionHeader eyebrow="Our delivery flow" title="A simple process for building serious digital work." text="Every project needs more than design. It needs clarity, structure, trust, usability and a launch path." />
        <div className="container process-grid">{process.map((item, index) => <motion.div key={item.step} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.08 }}><span>{item.step}</span><h3>{item.title}</h3><p>{item.text}</p></motion.div>)}</div>
      </section>

      <section className="section container principle-grid">
        <div className="quote-card"><Quote /><p>“The standard is not just something that works. The standard is something that feels credible, premium and ready to impress clients.”</p><span>Creovate Global design principle</span></div>
        <div className="value-grid">{[["Trust","Make the business feel serious before the first call."],["Beauty","Use polish, spacing, motion and visual hierarchy intentionally."],["Usefulness","Every section should support a real customer decision."]].map(([title,text]) => <div key={title}><Star /><h3>{title}</h3><p>{text}</p></div>)}</div>
      </section>

      <section id="contact" className="contact-wrap container">
        <div className="contact-panel">
          <div><span>Ready when the idea needs to look serious</span><h2>Let’s build something your clients will trust.</h2><p>Start with a website, MVP, dashboard, client portal or business system. We will shape it with premium design, practical structure and a clear launch path.</p></div>
          <div className="contact-card"><Mail /><h3>One-click project enquiry</h3><p>Click once to open your email app with a ready-made project enquiry template. You can quickly add your details and send it to Creovate Global.</p><a href={enquiryEmail} className="btn btn-light">Send project enquiry <ArrowRight /></a><a href={consultationEmail} className="btn btn-red">Book consultation <ArrowRight /></a></div>
        </div>
      </section>

      <footer><div className="container footer-inner"><div><strong>Creovate Global</strong><p>Premium digital systems for real-world business problems.</p></div><span>© 2026 Creovate Global. Built with clarity, beauty and trust.</span></div></footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);

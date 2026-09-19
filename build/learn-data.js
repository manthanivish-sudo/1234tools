/**
 * The curated reading list behind /learn/.
 *
 * Rules this list is kept to, because a directory is only worth the judgement
 * in it:
 *
 *   Primary sources first. A university, a standards body, the people who
 *   wrote the language. Those move less and go stale slower than a blog.
 *
 *   No affiliate links, ever. Nothing here pays this site, which is the only
 *   reason a recommendation on it means anything.
 *
 *   Cost stated plainly. `free` means you can finish it without paying;
 *   `free-tier` means a real but limited free portion; `paid` means it is not
 *   free and is listed anyway because it is the best of its kind.
 *
 *   Say what it actually is. "Comprehensive resource for learners" is filler.
 *   The note should tell you whether to click.
 *
 * Every URL here is checked by build/check-links.js before the pages are
 * generated, and weekly after that.
 */
'use strict';

const CATEGORIES = [
  {
    slug: 'ai',
    name: 'AI & Machine Learning',
    icon: 'i-ai',
    blurb: 'From "what is a tensor" to fine-tuning a model on your own data.',
    /* The editorial bit. A list without one of these is a bookmark dump. */
    guidance: 'Start with the Google crash course if you want the vocabulary, or fast.ai if you would rather train something in week one and learn the theory when you hit it. Karpathy is the best route to understanding what a neural network is actually doing, and it is worth doing before you reach for a framework. The Hugging Face and provider courses are where to go once you are building rather than studying.',
    links: [
      ['Practical Deep Learning for Coders', 'https://course.fast.ai/', 'fast.ai', 'free',
        'Trains a working image classifier in lesson one and explains the theory afterwards. The opposite order to most courses, and it suits people who already program.'],
      ['Machine Learning Crash Course', 'https://developers.google.com/machine-learning/crash-course', 'Google', 'free',
        'The standard grounding: loss, gradient descent, overfitting, feature crosses. Short videos with interactive exercises, and no framework commitment.'],
      ['Neural Networks: Zero to Hero', 'https://karpathy.ai/zero-to-hero.html', 'Andrej Karpathy', 'free',
        'Builds backpropagation, then a language model, from an empty file. If you have used a neural network without knowing what it does, this is the fix.'],
      ['Hugging Face Learn', 'https://huggingface.co/learn', 'Hugging Face', 'free',
        'Courses on transformers, diffusion, audio and agents, written by the people who maintain the libraries you would use.'],
      ['Kaggle Learn', 'https://www.kaggle.com/learn', 'Kaggle', 'free',
        'Short, practical micro-courses in a browser notebook. Good for filling a specific gap rather than learning the field.'],
      ['AI for Beginners', 'https://microsoft.github.io/AI-For-Beginners/', 'Microsoft', 'free',
        'A twelve-week structured curriculum with quizzes and labs, covering symbolic AI as well as neural networks.'],
      ['Elements of AI', 'https://www.elementsofai.com/', 'University of Helsinki', 'free',
        'Non-technical and genuinely good at it. The one to send to a colleague who needs to understand AI without writing code.'],
      ['DeepLearning.AI short courses', 'https://www.deeplearning.ai/courses/', 'DeepLearning.AI', 'free',
        'Hour-long courses built with model providers on narrow, current topics — RAG, evaluation, agents. Useful once you know the basics.'],
      ['Anthropic courses', 'https://github.com/anthropics/courses', 'Anthropic', 'free',
        'Notebooks on prompt engineering, tool use and evaluation, from the people who build Claude.'],
      ['OpenAI Cookbook', 'https://developers.openai.com/cookbook', 'OpenAI', 'free',
        'Working recipes rather than tutorials. Where to look when you know what you want to build and need the shape of the code.'],
      ['CS229: Machine Learning', 'https://cs229.stanford.edu/', 'Stanford University', 'free',
        'The mathematical treatment, with lecture notes and problem sets. Assumes linear algebra and probability.']
    ]
  },
  {
    slug: 'programming',
    name: 'Programming',
    icon: 'i-code',
    blurb: 'Languages, fundamentals, and the long-form courses worth finishing.',
    guidance: 'If you are starting from nothing, The Odin Project and freeCodeCamp are the two that take you all the way to building things, and both are genuinely free rather than free-to-sample. CS50 is the better choice if you want computer science rather than web development. Everything else here is a reference you will come back to for years.',
    links: [
      ['freeCodeCamp', 'https://www.freecodecamp.org/learn', 'freeCodeCamp', 'free',
        'Thousands of hours of certification tracks with in-browser exercises. Nonprofit, no upsell, and the projects are portfolio-worthy.'],
      ['The Odin Project', 'https://www.theodinproject.com/', 'The Odin Project', 'free',
        'A full-stack curriculum that makes you set up a real local environment rather than coding in a sandbox, which is the part most courses skip.'],
      ['CS50x: Introduction to Computer Science', 'https://cs50.harvard.edu/x/', 'Harvard University', 'free',
        'The best-produced introductory CS course there is. Starts in C on purpose, so you understand memory before you meet a garbage collector.'],
      ['MDN Web Docs: Learn', 'https://developer.mozilla.org/en-US/docs/Learn_web_development', 'Mozilla', 'free',
        'The reference for HTML, CSS and JavaScript, with a structured learning path. If a tutorial disagrees with MDN, trust MDN.'],
      ['The Python Tutorial', 'https://docs.python.org/3/tutorial/', 'Python Software Foundation', 'free',
        'The official one. Dry, short, and correct — a better first week than most paid Python courses.'],
      ['The Rust Programming Language', 'https://doc.rust-lang.org/book/', 'Rust Foundation', 'free',
        'Known as "the book". Unusually well written, and the ownership chapters are worth reading even if you never write Rust.'],
      ['Go by Example', 'https://gobyexample.com/', 'Go by Example', 'free',
        'Annotated programs, one concept each. The fastest way into Go if you already program.'],
      ['JavaScript.info', 'https://javascript.info/', 'JavaScript.info', 'free',
        'Deep and current, covering the language itself and the browser. Better than most books and kept up to date.'],
      ['Eloquent JavaScript', 'https://eloquentjavascript.net/', 'Marijn Haverbeke', 'free',
        'A book about programming that happens to use JavaScript, with exercises in the page. Read it after the basics, not before.'],
      ['Full Stack Open', 'https://fullstackopen.com/en/', 'University of Helsinki', 'free',
        'React, Node, GraphQL and TypeScript as one continuous project. Demanding, and the closest free equivalent to a bootcamp.'],
      ['Exercism', 'https://exercism.org/', 'Exercism', 'free',
        'Practice problems in 70-odd languages with human mentoring. The mentoring is the point — it is where you learn idiom.'],
      ['Learn X in Y Minutes', 'https://learnxinyminutes.com/', 'Learn X in Y Minutes', 'free',
        'One annotated file per language. Not a course; the right page when you need to read code in something unfamiliar today.']
    ]
  },
  {
    slug: 'data',
    name: 'Data & Analytics',
    icon: 'i-analytics',
    blurb: 'SQL, analysis, statistics in practice, and making charts that tell the truth.',
    guidance: 'SQL is the highest-return thing on this page for most office work, and SQLBolt will get you further in an afternoon than a week of video. Learn the analysis library after the query language, not before. For charts, the Financial Times and Datawrapper guidance below will stop you making the three mistakes everybody makes.',
    links: [
      ['SQLBolt', 'https://sqlbolt.com/', 'SQLBolt', 'free',
        'Interactive SQL lessons that run in the page. No signup, no setup, and you can finish the core in an afternoon.'],
      ['Mode SQL Tutorial', 'https://www.thoughtspot.com/sql-tutorial', 'Mode', 'free',
        'Picks up where the basics stop: window functions, performance, and how analysts actually structure a query.'],
      ['Select Star SQL', 'https://selectstarsql.com/', 'Select Star SQL', 'free',
        'A book-length SQL tutorial built around one real dataset, with the queries executable inline.'],
      ['PostgreSQL Tutorial', 'https://neon.com/postgresql/tutorial', 'Neon', 'free',
        'Thorough and example-led. Useful even if you are on another database, since most of it is standard SQL.'],
      ['pandas: Getting started', 'https://pandas.pydata.org/docs/getting_started/index.html', 'pandas', 'free',
        'The official entry point, including a comparison guide for people arriving from Excel or SQL.'],
      ['Seeing Theory', 'https://seeing-theory.brown.edu/', 'Brown University', 'free',
        'Probability and statistics as interactive visualisations. The clearest explanation of confidence intervals on the internet.'],
      ['StatQuest', 'https://statquest.org/', 'Josh Starmer', 'free',
        'Statistics and machine learning explained slowly and without hand-waving. The go-to when a concept has not landed.'],
      ['Our World in Data', 'https://ourworldindata.org/', 'Global Change Data Lab', 'free',
        'Research-grade datasets and charts on almost every global indicator, all downloadable and openly licensed.'],
      ['Financial Times Visual Vocabulary', 'https://github.com/Financial-Times/chart-doctor/tree/main/visual-vocabulary', 'Financial Times', 'free',
        'A one-page answer to "which chart should this be". Worth printing.'],
      ['D3.js', 'https://d3js.org/', 'D3', 'free',
        'The library behind most bespoke data visualisation on the web, with a gallery that doubles as a teaching resource.'],
      ['Kaggle Datasets', 'https://www.kaggle.com/datasets', 'Kaggle', 'free',
        'Somewhere to practise on data that is messy in the ways real data is messy.']
    ]
  },
  {
    slug: 'cloud',
    name: 'Cloud & DevOps',
    icon: 'i-cloud',
    blurb: 'The three big providers, containers, infrastructure as code, and where to practise.',
    guidance: 'Learn one provider properly rather than three badly — the concepts transfer, the console does not. Do the container work before the orchestration work; Kubernetes makes very little sense until Docker does. The sandbox sites in the labs section are where to practise without leaving a billing surprise behind.',
    links: [
      ['Microsoft Learn Training', 'https://learn.microsoft.com/en-us/training/', 'Microsoft', 'free',
        'Structured Azure and Microsoft 365 paths with hands-on sandboxes included, at no cost. The most generous free offering of the three.'],
      ['AWS Skill Builder', 'https://skillbuilder.aws/', 'Amazon Web Services', 'free-tier',
        'The official AWS training catalogue. A substantial free tier; labs and exam preparation sit behind a subscription.'],
      ['Google Cloud Skills Boost', 'https://www.skills.google/', 'Google Cloud', 'free-tier',
        'Guided labs in a real, temporary GCP project. Some paths are free, most labs cost credits.'],
      ['Docker: Get started', 'https://docs.docker.com/get-started/', 'Docker', 'free',
        'The official walkthrough, from first container to compose. Do this before touching Kubernetes.'],
      ['Kubernetes Tutorials', 'https://kubernetes.io/docs/tutorials/', 'CNCF', 'free',
        'Official tutorials including an in-browser cluster, so you can learn the objects without provisioning anything.'],
      ['Terraform Tutorials', 'https://developer.hashicorp.com/terraform/tutorials', 'HashiCorp', 'free',
        'Infrastructure as code from first principles, with tracks per cloud provider.'],
      ['The Twelve-Factor App', 'https://12factor.net/', 'Heroku', 'free',
        'Twenty years on, still the clearest statement of what makes an application deployable. Short enough to read in one sitting.'],
      ['Roadmap.sh', 'https://roadmap.sh/', 'roadmap.sh', 'free',
        'Visual dependency maps of what to learn in what order, per role. Best used to spot gaps rather than as a curriculum.'],
      ['Site Reliability Engineering', 'https://sre.google/books/', 'Google', 'free',
        'The SRE books in full, online. Where error budgets and service level objectives come from.']
    ]
  },
  {
    slug: 'security',
    name: 'Cybersecurity',
    icon: 'i-shield',
    blurb: 'Web security, defensive practice, and legal places to break things.',
    guidance: 'Everything here is legal to practise on — that matters, and it is why no list of "vulnerable sites to try" appears below. PortSwigger is the single best free security resource on the internet and it is not close. Work through OWASP alongside it so you learn the vocabulary the industry hires on.',
    links: [
      ['Web Security Academy', 'https://portswigger.net/web-security', 'PortSwigger', 'free',
        'Free, complete, and with a live lab for every vulnerability class. Written by the team behind Burp Suite.'],
      ['OWASP Top Ten', 'https://owasp.org/projects/top-ten', 'OWASP', 'free',
        'The reference list of web application risks. The vocabulary every security conversation assumes you have.'],
      ['OWASP Cheat Sheet Series', 'https://cheatsheetseries.owasp.org/', 'OWASP', 'free',
        'Short, specific guidance on doing one thing safely — password storage, CSRF, file upload. Where to look before you implement.'],
      ['TryHackMe', 'https://tryhackme.com/', 'TryHackMe', 'free-tier',
        'Guided rooms with a browser machine. The gentlest on-ramp; a subscription unlocks the full paths.'],
      ['Hack The Box', 'https://www.hackthebox.com/', 'Hack The Box', 'free-tier',
        'Less guidance, harder boxes. The step after TryHackMe rather than instead of it.'],
      ['OverTheWire Wargames', 'https://overthewire.org/wargames/', 'OverTheWire', 'free',
        'Ancient, text-only, and still the best way to get genuinely comfortable on a Linux command line.'],
      ['picoCTF', 'https://picoctf.org/', 'Carnegie Mellon University', 'free',
        'Capture-the-flag built for teaching, with past competitions permanently playable.'],
      ['CryptoHack', 'https://cryptohack.org/', 'CryptoHack', 'free',
        'Cryptography taught by breaking it. Fixes the gap between "I use AES" and "I understand what I chose".'],
      ['NCSC Guidance', 'https://www.ncsc.gov.uk/section/advice-guidance/all-topics', 'UK National Cyber Security Centre', 'free',
        'Practical, government-issued guidance aimed at organisations rather than researchers. The defensive counterpart to everything above.']
    ]
  },
  {
    slug: 'labs',
    name: 'Hands-on Labs & Sandboxes',
    icon: 'i-flask',
    blurb: 'Places to run something now, without installing anything or risking a bill.',
    guidance: 'These are environments rather than courses — the answer to "I want to try this but not on my machine". Anything that needs a card to start is marked free-tier. Watch the session limits: most of these delete your work when the tab closes, so commit to a repository as you go.',
    links: [
      ['Killercoda', 'https://killercoda.com/', 'Killercoda', 'free',
        'Interactive terminal scenarios in the browser — Kubernetes, Linux, Docker. The successor to Katacoda after O’Reilly retired it.'],
      ['Play with Docker', 'https://labs.play-with-docker.com/', 'Docker', 'free',
        'A throwaway Docker host in a browser tab, four hours at a time. Ideal for trying compose files.'],
      ['Google Colab', 'https://colab.research.google.com/', 'Google', 'free-tier',
        'A hosted Python notebook with a free GPU allocation. Where most people run their first model.'],
      ['StackBlitz', 'https://stackblitz.com/', 'StackBlitz', 'free-tier',
        'Runs Node in the browser itself, so a full dev server starts in about a second with nothing installed.'],
      ['CodeSandbox', 'https://codesandbox.io/', 'CodeSandbox', 'free-tier',
        'Full project sandboxes with real containers. Better than StackBlitz when you need the actual filesystem.'],
      ['Replit', 'https://replit.com/', 'Replit', 'free-tier',
        'Multi-language online IDE with hosting. Good for teaching, since a link is a running program.'],
      ['GitHub Codespaces', 'https://github.com/features/codespaces', 'GitHub', 'free-tier',
        'A full VS Code environment attached to a repository, with a monthly free allowance on personal accounts.'],
      ['SQL Fiddle', 'https://sqlfiddle.com/', 'SQL Fiddle', 'free',
        'Build a schema and run queries against several database engines side by side. Useful for settling arguments.'],
      ['Regex101', 'https://regex101.com/', 'Regex101', 'free',
        'Explains a regular expression token by token as you type. The debugger the language never gave you.']
    ]
  },
  {
    slug: 'practice',
    name: 'Practice, Mocks & Interviews',
    icon: 'i-target',
    blurb: 'Problem sets, contests and mock interviews, for keeping sharp or preparing to be hired.',
    guidance: 'For interview preparation, a curated list beaten thoroughly beats a thousand problems attempted once — NeetCode exists for exactly that reason. Contests are a different skill from interviews; do them because they are enjoyable, not because you think they are the same practice. System design is the part most people under-prepare and it is the part senior interviews turn on.',
    links: [
      ['NeetCode', 'https://neetcode.io/', 'NeetCode', 'free-tier',
        'A curated ordering of the problems that actually recur, with worked video solutions. The efficient path through LeetCode.'],
      ['LeetCode', 'https://leetcode.com/', 'LeetCode', 'free-tier',
        'The de facto interview problem set. Company-tagged questions and mock timers need a subscription.'],
      ['HackerRank', 'https://www.hackerrank.com/', 'HackerRank', 'free',
        'Problems by domain plus skill certifications, and the platform many employers use for take-home screens.'],
      ['Codeforces', 'https://codeforces.com/', 'Codeforces', 'free',
        'The main competitive programming site. Regular rated contests and an enormous archive.'],
      ['AtCoder', 'https://atcoder.jp/', 'AtCoder', 'free',
        'Beginner contests with unusually clear problem statements and English editorials.'],
      ['Project Euler', 'https://projecteuler.net/', 'Project Euler', 'free',
        'Mathematical problems where the naive solution will not finish. Teaches complexity better than any lecture.'],
      ['Advent of Code', 'https://adventofcode.com/', 'Advent of Code', 'free',
        'Twenty-five puzzles each December, every past year still playable. The friendliest way to learn a new language.'],
      ['Codewars', 'https://www.codewars.com/', 'Codewars', 'free',
        'Small graded exercises where you can read everyone else’s solution afterwards, which is the useful part.'],
      ['System Design Primer', 'https://github.com/donnemartin/system-design-primer', 'Donne Martin', 'free',
        'The most complete free system design resource, with worked examples and flash cards.'],
      ['Pramp', 'https://www.pramp.com/', 'Pramp', 'free',
        'Free peer-to-peer mock interviews. You interview someone, then they interview you.']
    ]
  },
  {
    slug: 'certifications',
    name: 'Certifications & Exam Prep',
    icon: 'i-certificate',
    blurb: 'Official certification paths, and honest notes on which are worth paying for.',
    guidance: 'A certificate is worth what the hiring market pays for it, which varies enormously — cloud and security certifications clear that bar, most others do not. Always prepare from the official exam guide rather than a course description, because the guide is what the questions are written against. Everything listed here is the vendor’s own page, so the syllabus is the current one.',
    links: [
      ['AWS Certification', 'https://aws.amazon.com/certification/', 'Amazon Web Services', 'paid',
        'Exam guides, sample questions and the official path from Cloud Practitioner upwards. The guides are free even though the exams are not.'],
      ['Microsoft Credentials', 'https://learn.microsoft.com/en-us/credentials/', 'Microsoft', 'paid',
        'Azure, Security and Power Platform certifications, each with a free structured learning path attached.'],
      ['Google Cloud Certification', 'https://cloud.google.com/learn/certification', 'Google Cloud', 'paid',
        'Associate and Professional tracks. The Professional Cloud Architect case studies are published and worth reading early.'],
      ['CompTIA Certifications', 'https://www.comptia.org/en-us/certifications/', 'CompTIA', 'paid',
        'Vendor-neutral entry points — A+, Network+, Security+. Security+ is the one that opens doors in defensive security.'],
      ['Certified Kubernetes Administrator', 'https://www.cncf.io/training/certification/cka/', 'CNCF', 'paid',
        'Entirely hands-on: a real cluster and a time limit. One of the few certifications that cannot be passed by memorising.'],
      ['Certified in Cybersecurity (CC)', 'https://www.isc2.org/certifications/cc', 'ISC2', 'free-tier',
        'An entry-level security certification that ISC2 has been offering free of charge to newcomers, training included.'],
      ['Cisco Networking Academy', 'https://www.netacad.com/', 'Cisco', 'free-tier',
        'Free networking and security courses, including the CCNA preparation material.'],
      ['Project Management Institute', 'https://www.pmi.org/', 'PMI', 'paid',
        'CAPM and PMP. Worth it in organisations that ask for it by name, and rarely otherwise.']
    ]
  },
  {
    slug: 'mathematics',
    name: 'Mathematics & Statistics',
    icon: 'i-mathematics',
    blurb: 'The foundations under everything else on this page.',
    guidance: 'If you are here because machine learning needs it, the order is linear algebra, then calculus, then probability — and 3Blue1Brown before any of them, for the intuition. Khan Academy is the right choice if you need to rebuild school mathematics properly; there is no shame in starting there and it is the fastest route.',
    links: [
      ['Khan Academy: Mathematics', 'https://www.khanacademy.org/math', 'Khan Academy', 'free',
        'Complete school and early university mathematics with practice and mastery tracking. The best place to fill a gap you are embarrassed about.'],
      ['3Blue1Brown', 'https://www.3blue1brown.com/', 'Grant Sanderson', 'free',
        'Visual intuition for linear algebra, calculus and neural networks. Watch Essence of Linear Algebra before any ML course.'],
      ['MIT OpenCourseWare: Mathematics', 'https://ocw.mit.edu/search/?d=Mathematics', 'MIT', 'free',
        'Full lecture courses with notes, assignments and exams. 18.06 Linear Algebra is the famous one and deserves to be.'],
      ['OpenStax', 'https://openstax.org/subjects/math', 'Rice University', 'free',
        'Peer-reviewed, openly licensed textbooks. Real books, free, with exercises and answers.'],
      ['Paul’s Online Math Notes', 'https://tutorial.math.lamar.edu/', 'Lamar University', 'free',
        'Algebra through differential equations, written for students who are stuck. Worked examples rather than proofs.'],
      ['Immersive Math', 'https://immersivemath.com/ila/', 'Immersive Math', 'free',
        'A linear algebra textbook where every figure is interactive. Good alongside a more formal course.'],
      ['Probability and Statistics EBook', 'https://stats.libretexts.org/', 'LibreTexts', 'free',
        'An open statistics library covering introductory through graduate level, useful as a reference.']
    ]
  },
  {
    slug: 'business',
    name: 'Business, Finance & Compliance',
    icon: 'i-business',
    blurb: 'Accounting, tax and the primary sources for Indian and UK compliance.',
    guidance: 'For anything regulatory, go to the source. Summaries of tax rules go out of date silently and an accountant will not accept "a blog said so" — the official portals below are the ones that matter, and they are the ones that change first. The learning material is for building the understanding around them.',
    links: [
      ['GST Portal', 'https://www.gst.gov.in/', 'Government of India', 'free',
        'The official GST system: registration, returns and the rate finder. The authority for anything GST in India.'],
      ['Income Tax India', 'https://www.incometax.gov.in/iec/foportal/', 'Government of India', 'free',
        'Filing, forms and the current slabs. Where to check before trusting any calculator, including ours.'],
      ['CBIC', 'https://www.cbic.gov.in/', 'Government of India', 'free',
        'Central Board of Indirect Taxes and Customs — notifications and circulars, which is where rule changes appear first.'],
      ['ICAI', 'https://www.icai.org/', 'Institute of Chartered Accountants of India', 'free',
        'Standards, study material and announcements for Indian accounting practice.'],
      ['GOV.UK: Business and self-employed', 'https://www.gov.uk/browse/business', 'UK Government', 'free',
        'VAT, PAYE, Companies House and self-assessment, from the source.'],
      ['Companies House', 'https://find-and-update.company-information.service.gov.uk/', 'UK Government', 'free',
        'Free public filings for every UK company. Useful for checking who you are about to do business with.'],
      ['Khan Academy: Economics and Finance', 'https://www.khanacademy.org/economics-finance-domain', 'Khan Academy', 'free',
        'Interest, inflation, accounting statements and valuation, explained from zero.'],
      ['Investopedia', 'https://www.investopedia.com/', 'Investopedia', 'free',
        'The dictionary of finance. Best used to look one term up, not as a course.'],
      ['Corporate Finance Institute Resources', 'https://corporatefinanceinstitute.com/resources/', 'CFI', 'free-tier',
        'Free articles and templates on financial modelling and accounting; the certifications are paid.']
    ]
  },
  {
    slug: 'design',
    name: 'Design & UX',
    icon: 'i-design',
    blurb: 'Interface design, accessibility and research, for people who build things.',
    guidance: 'Most developers do not need to learn design so much as learn the handful of rules that make untrained work look untrained — spacing, type scale and contrast. Refactoring UI and Practical Typography cover that in an afternoon. Accessibility is not a design nicety; WCAG is a legal requirement in a growing number of places.',
    links: [
      ['Laws of UX', 'https://lawsofux.com/', 'Jon Yablonski', 'free',
        'The named heuristics — Fitts, Hick, Jakob — each on one page with an example. A shared vocabulary for design arguments.'],
      ['Nielsen Norman Group Articles', 'https://www.nngroup.com/articles/', 'Nielsen Norman Group', 'free',
        'Decades of usability research, published free. The evidence behind most received wisdom in UX.'],
      ['Practical Typography', 'https://practicaltypography.com/', 'Matthew Butterick', 'free',
        'Read the "Typography in ten minutes" page. It will improve every document you produce for the rest of your life.'],
      ['Material Design 3', 'https://m3.material.io/', 'Google', 'free',
        'A complete design system with the reasoning published alongside it. Worth reading even if you never use Material.'],
      ['Web Content Accessibility Guidelines', 'https://www.w3.org/WAI/standards-guidelines/wcag/', 'W3C', 'free',
        'The accessibility standard itself, plus the plain-language quick reference. Increasingly a legal requirement, not advice.'],
      ['A11y Project Checklist', 'https://www.a11yproject.com/checklist/', 'The A11Y Project', 'free',
        'WCAG turned into things you can actually check. The practical entry point to accessibility.'],
      ['Figma Learn', 'https://help.figma.com/hc/en-us/categories/360002051613', 'Figma', 'free',
        'Official tutorials for the tool most product teams now use by default.'],
      ['Google UX Design Certificate', 'https://www.coursera.org/professional-certificates/google-ux-design', 'Google', 'paid',
        'A structured career-change programme. Thorough, well regarded, and a genuine time commitment. Linked at Coursera because grow.google sends visitors outside the US to a country page instead.']
    ]
  }
];

module.exports = { CATEGORIES };

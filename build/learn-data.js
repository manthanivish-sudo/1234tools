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
 *   Level stated too. `basic` assumes nothing, `core` assumes you can already
 *   program or have done the basics, `advanced` assumes the core and some
 *   mathematics. Most directories hide this and waste people's evenings.
 *
 *   Say what it actually is. "Comprehensive resource for learners" is filler.
 *   The note should tell you whether to click.
 *
 * Shape: each category holds groups, each group holds links. The grouping is
 * the editorial part — it is what turns forty links into a path through a
 * subject rather than a pile.
 *
 *   link = [title, url, provider, cost, level, note]
 *
 * Every URL is checked by build/check-links.js before the pages are generated,
 * and weekly after that.
 */
'use strict';

const CATEGORIES = [
  {
    slug: 'ai',
    name: 'AI & Machine Learning',
    icon: 'i-ai',
    blurb: 'From "what is a tensor" to fine-tuning, agents and evaluation.',
    guidance: 'If you have never trained anything, start with the Google crash course for vocabulary or fast.ai to have something working in week one. If you can already program and want to understand what a network is really doing, Karpathy is the shortest honest route and worth doing before you reach for a framework. If you are building on top of a model rather than training one, skip straight to the provider documentation — that is a different skill and the courses above will not teach it.',
    groups: [
      {
        name: 'Start here',
        blurb: 'Enough to understand what everyone is talking about.',
        links: [
          ['Elements of AI', 'https://www.elementsofai.com/', 'University of Helsinki', 'free', 'basic',
            'Non-technical and genuinely good at it. The one to send to a colleague who needs to understand AI without writing code.'],
          ['Machine Learning Crash Course', 'https://developers.google.com/machine-learning/crash-course', 'Google', 'free', 'basic',
            'The standard grounding: loss, gradient descent, overfitting, feature crosses. Short videos with interactive exercises and no framework commitment.'],
          ['AI for Beginners', 'https://microsoft.github.io/AI-For-Beginners/', 'Microsoft', 'free', 'basic',
            'A twelve-week curriculum with quizzes and labs, covering symbolic AI as well as neural networks.'],
          ['Practical Deep Learning for Coders', 'https://course.fast.ai/', 'fast.ai', 'free', 'core',
            'Trains a working image classifier in lesson one and explains the theory afterwards. The opposite order to most courses, and it suits people who already program.'],
          ['Kaggle Learn', 'https://www.kaggle.com/learn', 'Kaggle', 'free', 'basic',
            'Short micro-courses in a browser notebook. Good for filling one specific gap rather than learning the field.']
        ]
      },
      {
        name: 'Understand what is happening',
        blurb: 'The part most people skip and later wish they had not.',
        links: [
          ['Neural Networks: Zero to Hero', 'https://karpathy.ai/zero-to-hero.html', 'Andrej Karpathy', 'free', 'core',
            'Builds backpropagation, then a language model, from an empty file. If you have used a neural network without knowing what it does, this is the fix.'],
          ['The Illustrated Transformer', 'https://jalammar.github.io/illustrated-transformer/', 'Jay Alammar', 'free', 'core',
            'The diagram everybody has seen, with the explanation that makes it land. Read before any paper that says "attention".'],
          ['Dive into Deep Learning', 'https://d2l.ai/', 'D2L.ai', 'free', 'core',
            'A full textbook where every equation has runnable code beside it, in PyTorch, TensorFlow and JAX.'],
          ['CS229: Machine Learning', 'https://cs229.stanford.edu/', 'Stanford University', 'free', 'advanced',
            'The mathematical treatment, with lecture notes and problem sets. Assumes linear algebra and probability.'],
          ['Spinning Up in Deep RL', 'https://spinningup.openai.com/en/latest/', 'OpenAI', 'free', 'advanced',
            'The clearest introduction to reinforcement learning there is, with implementations you can read.'],
          ['Distill', 'https://distill.pub/', 'Distill', 'free', 'advanced',
            'Archived but not obsolete: interactive explanations of what is happening inside models. The feature-visualisation work is still unmatched.']
        ]
      },
      {
        name: 'Building with models',
        blurb: 'If you are calling an API rather than training weights, this is your section.',
        links: [
          ['Claude Docs', 'https://platform.claude.com/docs/en/home', 'Anthropic', 'free', 'core',
            'The reference for building on Claude: prompting, tool use, context handling, agents and the API itself.'],
          ['Anthropic courses', 'https://github.com/anthropics/courses', 'Anthropic', 'free', 'core',
            'Notebooks on prompt engineering, tool use and evaluation, from the people who build the model.'],
          ['OpenAI Platform Docs', 'https://developers.openai.com/api/docs', 'OpenAI', 'free', 'core',
            'API reference and guides for the GPT models, including structured outputs and function calling.'],
          ['OpenAI Cookbook', 'https://developers.openai.com/cookbook', 'OpenAI', 'free', 'core',
            'Working recipes rather than tutorials. Where to look when you know what to build and need the shape of the code.'],
          ['GitHub Copilot Docs', 'https://docs.github.com/en/copilot', 'GitHub', 'free', 'basic',
            'How Copilot actually works, including the parts people miss: custom instructions, chat participants and enterprise controls.'],
          ['Gemini API Docs', 'https://ai.google.dev/gemini-api/docs', 'Google', 'free', 'core',
            'Reference for Google’s models, with a generous free tier for experimenting.'],
          ['Hugging Face Learn', 'https://huggingface.co/learn', 'Hugging Face', 'free', 'core',
            'Courses on transformers, diffusion, audio and agents, by the people who maintain the libraries you would use.'],
          ['Prompt Engineering Guide', 'https://www.promptingguide.ai/', 'DAIR.AI', 'free', 'basic',
            'A survey of prompting techniques with the papers behind them, rather than a list of magic phrases.'],
          ['LangChain Docs', 'https://docs.langchain.com/oss/python/langchain/overview', 'LangChain', 'free', 'core',
            'The most-used orchestration framework. Worth understanding even if you decide not to use it.'],
          ['LlamaIndex Docs', 'https://developers.llamaindex.ai/python/framework/', 'LlamaIndex', 'free', 'core',
            'Retrieval and indexing over your own documents, which is what most "chat with your data" projects actually need.'],
          ['Ollama', 'https://ollama.com/', 'Ollama', 'free', 'core',
            'Run open-weight models on your own machine with one command. The cheapest way to experiment without an API bill.'],
          ['DeepLearning.AI short courses', 'https://www.deeplearning.ai/courses/', 'DeepLearning.AI', 'free', 'core',
            'Hour-long courses built with model providers on narrow, current topics — RAG, evaluation, agents.']
        ]
      },
      {
        name: 'Evaluation, safety and keeping up',
        blurb: 'The difference between a demo and something you would put in front of a customer.',
        links: [
          ['Weights & Biases', 'https://wandb.ai/site', 'Weights & Biases', 'free-tier', 'core',
            'Experiment tracking. The moment you have run the same thing twice with different settings, you need this or something like it.'],
          ['arXiv: Machine Learning', 'https://arxiv.org/list/cs.LG/recent', 'Cornell University', 'free', 'advanced',
            'Where the papers land first. Unfiltered, so use a summary source alongside it rather than instead of it.'],
          ['Hugging Face Papers', 'https://huggingface.co/papers/trending', 'Hugging Face', 'free', 'advanced',
            'Trending papers with the implementations and discussion attached, which is how you tell a result from a claim. Where Papers with Code ended up.'],
          ['NIST AI Risk Management Framework', 'https://www.nist.gov/itl/ai-risk-management-framework', 'NIST', 'free', 'core',
            'The framework procurement teams increasingly ask about. Useful whether or not you find frameworks useful.'],
          ['EU AI Act Explorer', 'https://artificialintelligenceact.eu/', 'Future of Life Institute', 'free', 'core',
            'The regulation itself, browsable by article, with the risk tiers explained. Relevant to anyone shipping into the EU.']
        ]
      }
    ]
  },

  {
    slug: 'ai-trading',
    name: 'AI in Trading & Quant Finance',
    icon: 'i-trading',
    blurb: 'The discipline, the tooling, and an honest account of what does not work.',
    guidance: 'Read the warnings group first. That is not a formality — the single most useful thing this page can do is stop you paying for a signal service or an "AI trading bot", both of which are sold on the promise that they remove the need to understand any of this. Nothing here sells you a strategy, because anything genuinely profitable is not for sale. What is listed is the discipline: the statistics, the backtesting tooling that will show you your idea does not work, and the regulators who publish what the outcomes actually look like.',
    caution: 'Nothing on this page is investment advice and no link on it is a recommendation to trade. Most retail derivative accounts lose money. Anyone selling AI-generated signals, copy-trading or a guaranteed return is selling the thing that does not exist, and none of that is listed here.',
    groups: [
      {
        name: 'Before you risk anything',
        blurb: 'The regulators publish the numbers. Read them before the courses.',
        links: [
          ['FCA ScamSmart', 'https://www.fca.org.uk/consumers/protect-yourself-scams', 'UK Financial Conduct Authority', 'free', 'basic',
            'How investment fraud is actually pitched, and the register for checking whether a firm is authorised. The AI-trading-bot pitch is in here.'],
          ['SEC Investor.gov', 'https://www.investor.gov/', 'US Securities and Exchange Commission', 'free', 'basic',
            'Plain-language investor education from the regulator, including specific alerts on AI-themed investment claims.'],
          ['SEBI Investor Education', 'https://investor.sebi.gov.in/', 'Securities and Exchange Board of India', 'free', 'basic',
            'India’s regulator on what is and is not permitted, and how to verify an intermediary before you send money.'],
          ['ESMA Investor Corner', 'https://www.esma.europa.eu/investor-corner', 'European Securities and Markets Authority', 'free', 'basic',
            'The EU regulator on leveraged products, including the loss statistics firms are required to publish.']
        ]
      },
      {
        name: 'Learn the discipline',
        blurb: 'Quantitative finance is statistics with money attached. Do the statistics.',
        links: [
          ['QuantEcon Lectures', 'https://quantecon.org/lectures/', 'QuantEcon', 'free', 'advanced',
            'Open lecture series in economic modelling with Python and Julia, written by working economists. The most rigorous free material here.'],
          ['MIT 18.S096: Mathematics with Applications in Finance', 'https://ocw.mit.edu/courses/18-s096-topics-in-mathematics-with-applications-in-finance-fall-2013/', 'MIT', 'free', 'advanced',
            'Full lecture course on the mathematics underneath derivatives and portfolio theory.'],
          ['Khan Academy: Finance and Capital Markets', 'https://www.khanacademy.org/economics-finance-domain/core-finance', 'Khan Academy', 'free', 'basic',
            'What an option, a bond and a balance sheet actually are. Start here if any of those words are fuzzy.'],
          ['Aswath Damodaran', 'https://pages.stern.nyu.edu/~adamodar/', 'NYU Stern', 'free', 'advanced',
            'Full valuation courses, datasets and spreadsheets, published free by the person who wrote the textbook.'],
          ['MLFinLab', 'https://github.com/hudson-and-thames/mlfinlab', 'Hudson & Thames', 'free-tier', 'advanced',
            'Open implementations of the labelling and cross-validation methods that stop financial backtests lying to you.']
        ]
      },
      {
        name: 'Tools and data',
        blurb: 'Test the idea on history before it costs you anything.',
        links: [
          ['Backtrader', 'https://www.backtrader.com/', 'Backtrader', 'free', 'core',
            'Mature Python backtesting framework. Slower than the newer ones and better documented than all of them.'],
          ['VectorBT', 'https://vectorbt.dev/', 'VectorBT', 'free-tier', 'advanced',
            'Vectorised backtesting fast enough to sweep thousands of parameter combinations — which is also the fastest way to overfit, so pair it with proper validation.'],
          ['QuantLib', 'https://www.quantlib.org/', 'QuantLib', 'free', 'advanced',
            'The open-source library for derivative pricing and risk. What the industry checks its numbers against.'],
          ['yfinance', 'https://github.com/ranaroussi/yfinance', 'ranaroussi', 'free', 'core',
            'The usual free price history for experiments. Fine for learning, not clean enough to trade on.'],
          ['World Bank Open Data', 'https://data.worldbank.org/', 'World Bank', 'free', 'core',
            'Free global development and macroeconomic indicators, with an open API and bulk downloads.'],
          ['OECD Data', 'https://www.oecd.org/en/data.html', 'OECD', 'free', 'core',
            'Comparable economic statistics across member countries. The series behind a great many charts you have seen.'],
          ['NSE India', 'https://www.nseindia.com/', 'National Stock Exchange of India', 'free', 'basic',
            'Official Indian market data, circulars and instrument lists, from the exchange itself.']
        ]
      }
    ]
  },

  {
    slug: 'programming',
    name: 'Programming',
    icon: 'i-code',
    blurb: 'Languages, fundamentals, and the long-form courses worth finishing.',
    guidance: 'From nothing, The Odin Project and freeCodeCamp both take you all the way to building things and are genuinely free rather than free-to-sample. CS50 is the better choice if you want computer science rather than web development. Everything in Reference is something you will come back to for years rather than work through once.',
    groups: [
      {
        name: 'From nothing',
        blurb: 'Complete paths, not tasters.',
        links: [
          ['freeCodeCamp', 'https://www.freecodecamp.org/learn', 'freeCodeCamp', 'free', 'basic',
            'Thousands of hours of certification tracks with in-browser exercises. Nonprofit, no upsell, portfolio-worthy projects.'],
          ['The Odin Project', 'https://www.theodinproject.com/', 'The Odin Project', 'free', 'basic',
            'A full-stack curriculum that makes you set up a real local environment rather than coding in a sandbox, which is the part most courses skip.'],
          ['CS50x: Introduction to Computer Science', 'https://cs50.harvard.edu/x/', 'Harvard University', 'free', 'basic',
            'The best-produced introductory CS course there is. Starts in C on purpose, so you meet memory before you meet a garbage collector.'],
          ['Full Stack Open', 'https://fullstackopen.com/en/', 'University of Helsinki', 'free', 'core',
            'React, Node, GraphQL and TypeScript as one continuous project. Demanding, and the closest free equivalent to a bootcamp.']
        ]
      },
      {
        name: 'One language properly',
        links: [
          ['The Python Tutorial', 'https://docs.python.org/3/tutorial/', 'Python Software Foundation', 'free', 'basic',
            'The official one. Dry, short and correct — a better first week than most paid Python courses.'],
          ['JavaScript.info', 'https://javascript.info/', 'JavaScript.info', 'free', 'core',
            'Deep and current, covering the language and the browser. Better than most books and kept up to date.'],
          ['Eloquent JavaScript', 'https://eloquentjavascript.net/', 'Marijn Haverbeke', 'free', 'core',
            'A book about programming that happens to use JavaScript, with exercises in the page. After the basics, not before.'],
          ['The Rust Programming Language', 'https://doc.rust-lang.org/book/', 'Rust Foundation', 'free', 'core',
            'Known as "the book". Unusually well written, and the ownership chapters are worth reading even if you never write Rust.'],
          ['Go by Example', 'https://gobyexample.com/', 'Go by Example', 'free', 'core',
            'Annotated programs, one concept each. The fastest way into Go if you already program.'],
          ['TypeScript Handbook', 'https://www.typescriptlang.org/docs/handbook/intro.html', 'Microsoft', 'free', 'core',
            'The official reference. Read the narrowing and generics chapters; they are where the value is.'],
          ['Learn X in Y Minutes', 'https://learnxinyminutes.com/', 'Learn X in Y Minutes', 'free', 'core',
            'One annotated file per language. Not a course; the right page when you must read code in something unfamiliar today.']
        ]
      },
      {
        name: 'Reference and craft',
        links: [
          ['MDN Web Docs: Learn', 'https://developer.mozilla.org/en-US/docs/Learn_web_development', 'Mozilla', 'free', 'basic',
            'The reference for HTML, CSS and JavaScript, with a structured path. If a tutorial disagrees with MDN, trust MDN.'],
          ['Pro Git', 'https://git-scm.com/book/en/v2', 'Git', 'free', 'core',
            'The whole book, free. The plumbing chapter is what turns git from incantations into a model you can reason about.'],
          ['Refactoring Guru', 'https://refactoring.guru/', 'Refactoring Guru', 'free-tier', 'core',
            'Design patterns and refactorings with diagrams and code in several languages. Clear without being shallow.'],
          ['Exercism', 'https://exercism.org/', 'Exercism', 'free', 'core',
            'Practice problems in 70-odd languages with human mentoring. The mentoring is the point — it is where you learn idiom.'],
          ['The Twelve-Factor App', 'https://12factor.net/', 'Heroku', 'free', 'basic',
            'Still the clearest statement of what makes an application deployable. Short enough to read in one sitting.'],
          ['Google Engineering Practices', 'https://google.github.io/eng-practices/', 'Google', 'free', 'core',
            'How to review code, and how to write a change that is easy to review. Short, specific and widely adopted.']
        ]
      }
    ]
  },

  {
    slug: 'data',
    name: 'Data & Analytics',
    icon: 'i-analytics',
    blurb: 'SQL, analysis, statistics in practice, and charts that tell the truth.',
    guidance: 'SQL is the highest-return thing on this page for most office work, and SQLBolt will get you further in an afternoon than a week of video. Learn the query language before the analysis library. For charts, the Financial Times vocabulary will stop you making the three mistakes everybody makes.',
    groups: [
      {
        name: 'SQL',
        links: [
          ['SQLBolt', 'https://sqlbolt.com/', 'SQLBolt', 'free', 'basic',
            'Interactive lessons that run in the page. No signup, no setup, and you can finish the core in an afternoon.'],
          ['Mode SQL Tutorial', 'https://www.thoughtspot.com/sql-tutorial', 'ThoughtSpot', 'free', 'core',
            'Picks up where the basics stop: window functions, performance, and how analysts actually structure a query.'],
          ['Select Star SQL', 'https://selectstarsql.com/', 'Select Star SQL', 'free', 'core',
            'A book-length tutorial built around one real dataset, with queries executable inline.'],
          ['PostgreSQL Tutorial', 'https://neon.com/postgresql/tutorial', 'Neon', 'free', 'core',
            'Thorough and example-led. Useful even on another database, since most of it is standard SQL.'],
          ['Use The Index, Luke', 'https://use-the-index-luke.com/', 'Markus Winand', 'free', 'advanced',
            'How database indexes actually work. The single best explanation of why your query is slow.']
        ]
      },
      {
        name: 'Analysis and statistics',
        links: [
          ['pandas: Getting started', 'https://pandas.pydata.org/docs/getting_started/index.html', 'pandas', 'free', 'core',
            'The official entry point, with comparison guides for people arriving from Excel or SQL.'],
          ['Seeing Theory', 'https://seeing-theory.brown.edu/', 'Brown University', 'free', 'basic',
            'Probability and statistics as interactive visualisations. The clearest explanation of confidence intervals anywhere.'],
          ['StatQuest', 'https://statquest.org/', 'Josh Starmer', 'free', 'basic',
            'Statistics and machine learning explained slowly and without hand-waving. The go-to when a concept has not landed.'],
          ['Think Stats', 'https://allendowney.github.io/ThinkStats/', 'Allen Downey', 'free', 'core',
            'Statistics taught through programming rather than formulas, with the whole book free online.'],
          ['Polars', 'https://docs.pola.rs/', 'Polars', 'free', 'advanced',
            'The dataframe library worth learning after pandas, when the data stops fitting comfortably in memory.']
        ]
      },
      {
        name: 'Visualisation',
        links: [
          ['FT Visual Vocabulary', 'https://github.com/Financial-Times/chart-doctor/tree/main/visual-vocabulary', 'Financial Times', 'free', 'basic',
            'A one-page answer to "which chart should this be". Worth printing.'],
          ['D3.js', 'https://d3js.org/', 'D3', 'free', 'advanced',
            'The library behind most bespoke data visualisation on the web, with a gallery that doubles as teaching.'],
          ['Observable Plot', 'https://observablehq.com/plot/', 'Observable', 'free', 'core',
            'From the makers of D3, for when you want a chart rather than a custom visualisation. Far less code.'],
          ['Datawrapper Academy', 'https://www.datawrapper.de/academy', 'Datawrapper', 'free', 'basic',
            'Practical guidance on colour, annotation and chart choice from a newsroom charting tool.']
        ]
      },
      {
        name: 'Data to practise on',
        links: [
          ['Our World in Data', 'https://ourworldindata.org/', 'Global Change Data Lab', 'free', 'basic',
            'Research-grade datasets and charts on almost every global indicator, downloadable and openly licensed.'],
          ['Kaggle Datasets', 'https://www.kaggle.com/datasets', 'Kaggle', 'free', 'basic',
            'Somewhere to practise on data that is messy in the ways real data is messy.'],
          ['data.gov.uk', 'https://www.data.gov.uk/', 'UK Government', 'free', 'basic',
            'UK public datasets, from transport to spending. Real, current and often genuinely awkward to parse.'],
          ['data.gov.in', 'https://www.data.gov.in/', 'Government of India', 'free', 'basic',
            'India’s open government data platform, with a large catalogue across sectors.']
        ]
      }
    ]
  },

  {
    slug: 'cloud',
    name: 'Cloud & DevOps',
    icon: 'i-cloud',
    blurb: 'The three big providers, containers, infrastructure as code, reliability.',
    guidance: 'Learn one provider properly rather than three badly — the concepts transfer, the console does not. Do containers before orchestration; Kubernetes makes very little sense until Docker does. Microsoft Learn is the most generous of the three free offerings by a distance.',
    groups: [
      {
        name: 'Providers',
        links: [
          ['Microsoft Learn Training', 'https://learn.microsoft.com/en-us/training/', 'Microsoft', 'free', 'basic',
            'Structured Azure and Microsoft 365 paths with hands-on sandboxes included at no cost. The most generous free offering of the three.'],
          ['AWS Skill Builder', 'https://skillbuilder.aws/', 'Amazon Web Services', 'free-tier', 'basic',
            'The official AWS catalogue. Substantial free tier; labs and exam preparation sit behind a subscription.'],
          ['Google Cloud Skills Boost', 'https://www.skills.google/', 'Google Cloud', 'free-tier', 'basic',
            'Guided labs in a real, temporary GCP project. Some paths free, most labs cost credits.'],
          ['AWS Well-Architected Framework', 'https://aws.amazon.com/architecture/well-architected/', 'Amazon Web Services', 'free', 'core',
            'The five pillars, and the questions a review actually asks. Useful on any cloud, not just AWS.']
        ]
      },
      {
        name: 'Containers and orchestration',
        links: [
          ['Docker: Get started', 'https://docs.docker.com/get-started/', 'Docker', 'free', 'basic',
            'The official walkthrough, from first container to compose. Do this before touching Kubernetes.'],
          ['Kubernetes Tutorials', 'https://kubernetes.io/docs/tutorials/', 'CNCF', 'free', 'core',
            'Official tutorials including an in-browser cluster, so you can learn the objects without provisioning anything.'],
          ['Kubernetes the Hard Way', 'https://github.com/kelseyhightower/kubernetes-the-hard-way', 'Kelsey Hightower', 'free', 'advanced',
            'Build a cluster component by component with no automation. Nobody runs it this way; everybody should do it once.'],
          ['Terraform Tutorials', 'https://developer.hashicorp.com/terraform/tutorials', 'HashiCorp', 'free', 'core',
            'Infrastructure as code from first principles, with tracks per cloud provider.']
        ]
      },
      {
        name: 'Running things reliably',
        links: [
          ['Site Reliability Engineering', 'https://sre.google/books/', 'Google', 'free', 'core',
            'The SRE books in full, online. Where error budgets and service level objectives come from.'],
          ['Prometheus Docs', 'https://prometheus.io/docs/introduction/overview/', 'Prometheus', 'free', 'core',
            'The de facto metrics system. The data-model page is the one that makes the rest make sense.'],
          ['OpenTelemetry Docs', 'https://opentelemetry.io/docs/', 'CNCF', 'free', 'core',
            'The vendor-neutral standard for traces, metrics and logs. Increasingly the thing everything else speaks.'],
          ['Roadmap.sh', 'https://roadmap.sh/', 'roadmap.sh', 'free', 'basic',
            'Visual dependency maps of what to learn in what order, per role. Best for spotting gaps rather than as a curriculum.']
        ]
      }
    ]
  },

  {
    slug: 'security',
    name: 'Cybersecurity',
    icon: 'i-shield',
    blurb: 'Web security, defensive practice, and legal places to break things.',
    guidance: 'Everything here is legal to practise on — that matters, and it is why no list of "vulnerable sites to try" appears. PortSwigger is the single best free security resource on the internet and it is not close. Work through OWASP alongside it so you learn the vocabulary the industry hires on.',
    groups: [
      {
        name: 'Learn the attacks',
        links: [
          ['Web Security Academy', 'https://portswigger.net/web-security', 'PortSwigger', 'free', 'core',
            'Free, complete, and with a live lab for every vulnerability class. Written by the team behind Burp Suite.'],
          ['OWASP Top Ten', 'https://owasp.org/projects/top-ten', 'OWASP', 'free', 'basic',
            'The reference list of web application risks. The vocabulary every security conversation assumes you have.'],
          ['CryptoHack', 'https://cryptohack.org/', 'CryptoHack', 'free', 'advanced',
            'Cryptography taught by breaking it. Fixes the gap between "I use AES" and "I understand what I chose".'],
          ['Exploit Education', 'https://exploit.education/', 'Exploit Education', 'free', 'advanced',
            'Memory corruption and privilege escalation on deliberately vulnerable virtual machines you run yourself.']
        ]
      },
      {
        name: 'Defend',
        links: [
          ['OWASP Cheat Sheet Series', 'https://cheatsheetseries.owasp.org/', 'OWASP', 'free', 'core',
            'Short, specific guidance on doing one thing safely — password storage, CSRF, file upload. Where to look before you implement.'],
          ['NCSC Guidance', 'https://www.ncsc.gov.uk/section/advice-guidance/all-topics', 'UK National Cyber Security Centre', 'free', 'basic',
            'Practical, government-issued guidance aimed at organisations rather than researchers.'],
          ['CISA Known Exploited Vulnerabilities', 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', 'CISA', 'free', 'core',
            'The catalogue of vulnerabilities being exploited right now. The correct patching priority list, free.'],
          ['MITRE ATT&CK', 'https://attack.mitre.org/', 'MITRE', 'free', 'core',
            'The shared taxonomy of how intrusions actually proceed. What detection engineering is written against.']
        ]
      },
      {
        name: 'Practise legally',
        links: [
          ['TryHackMe', 'https://tryhackme.com/', 'TryHackMe', 'free-tier', 'basic',
            'Guided rooms with a browser machine. The gentlest on-ramp; a subscription unlocks the full paths.'],
          ['Hack The Box', 'https://www.hackthebox.com/', 'Hack The Box', 'free-tier', 'advanced',
            'Less guidance, harder boxes. The step after TryHackMe rather than instead of it.'],
          ['OverTheWire Wargames', 'https://overthewire.org/wargames/', 'OverTheWire', 'free', 'basic',
            'Ancient, text-only, and still the best way to get genuinely comfortable on a Linux command line.'],
          ['picoCTF', 'https://picoctf.org/', 'Carnegie Mellon University', 'free', 'basic',
            'Capture-the-flag built for teaching, with past competitions permanently playable.']
        ]
      }
    ]
  },

  {
    slug: 'labs',
    name: 'Hands-on Labs & Sandboxes',
    icon: 'i-flask',
    blurb: 'Places to run something now, without installing anything or risking a bill.',
    guidance: 'These are environments rather than courses — the answer to "I want to try this but not on my machine". Anything needing a card is marked free-tier. Watch the session limits: most delete your work when the tab closes, so commit to a repository as you go.',
    groups: [
      {
        name: 'Terminals and clusters',
        links: [
          ['Killercoda', 'https://killercoda.com/', 'Killercoda', 'free', 'core',
            'Interactive terminal scenarios in the browser — Kubernetes, Linux, Docker. The successor to Katacoda after O’Reilly retired it.'],
          ['Play with Docker', 'https://labs.play-with-docker.com/', 'Docker', 'free', 'core',
            'A throwaway Docker host in a browser tab, four hours at a time. Ideal for trying compose files.'],
          ['Instruqt', 'https://play.instruqt.com/', 'Instruqt', 'free-tier', 'core',
            'Vendor-built hands-on tracks, many of them free, on real infrastructure rather than a simulation.']
        ]
      },
      {
        name: 'Code and notebooks',
        links: [
          ['Google Colab', 'https://colab.research.google.com/', 'Google', 'free-tier', 'basic',
            'A hosted Python notebook with a free GPU allocation. Where most people run their first model.'],
          ['StackBlitz', 'https://stackblitz.com/', 'StackBlitz', 'free-tier', 'basic',
            'Runs Node in the browser itself, so a full dev server starts in about a second with nothing installed.'],
          ['CodeSandbox', 'https://codesandbox.io/', 'CodeSandbox', 'free-tier', 'basic',
            'Full project sandboxes with real containers. Better than StackBlitz when you need the actual filesystem.'],
          ['Replit', 'https://replit.com/', 'Replit', 'free-tier', 'basic',
            'Multi-language online IDE with hosting. Good for teaching, since a link is a running program.'],
          ['GitHub Codespaces', 'https://github.com/features/codespaces', 'GitHub', 'free-tier', 'core',
            'A full VS Code environment attached to a repository, with a monthly free allowance on personal accounts.'],
          ['Jupyter: Try it', 'https://jupyter.org/try', 'Project Jupyter', 'free', 'basic',
            'Jupyter running in the browser with nothing installed, including the newer JupyterLite build.']
        ]
      },
      {
        name: 'Single-purpose scratchpads',
        links: [
          ['Regex101', 'https://regex101.com/', 'Regex101', 'free', 'basic',
            'Explains a regular expression token by token as you type. The debugger the language never gave you.'],
          ['SQL Fiddle', 'https://sqlfiddle.com/', 'SQL Fiddle', 'free', 'basic',
            'Build a schema and run queries against several database engines side by side. Useful for settling arguments.'],
          ['Compiler Explorer', 'https://godbolt.org/', 'Compiler Explorer', 'free', 'advanced',
            'See the assembly your code compiles to, across compilers and flags. The fastest way to understand what the optimiser does.'],
          ['CyberChef', 'https://gchq.github.io/CyberChef/', 'GCHQ', 'free', 'core',
            'Encoding, decoding, hashing and forensics as drag-and-drop operations. Runs entirely in the browser.']
        ]
      }
    ]
  },

  {
    slug: 'practice',
    name: 'Practice, Mocks & Interviews',
    icon: 'i-target',
    blurb: 'Problem sets, contests and mock interviews, for keeping sharp or getting hired.',
    guidance: 'For interviews, a curated list beaten thoroughly beats a thousand problems attempted once — NeetCode exists for exactly that reason. Contests are a different skill from interviews; do them because they are enjoyable, not because you think they are the same practice. System design is the part most people under-prepare and the part senior interviews turn on.',
    groups: [
      {
        name: 'Interview preparation',
        links: [
          ['NeetCode', 'https://neetcode.io/', 'NeetCode', 'free-tier', 'core',
            'A curated ordering of the problems that actually recur, with worked video solutions. The efficient path through LeetCode.'],
          ['LeetCode', 'https://leetcode.com/', 'LeetCode', 'free-tier', 'core',
            'The de facto interview problem set. Company-tagged questions and mock timers need a subscription.'],
          ['System Design Primer', 'https://github.com/donnemartin/system-design-primer', 'Donne Martin', 'free', 'advanced',
            'The most complete free system design resource, with worked examples and flash cards.'],
          ['Pramp', 'https://www.pramp.com/', 'Pramp', 'free', 'core',
            'Free peer-to-peer mock interviews. You interview someone, then they interview you.'],
          ['Tech Interview Handbook', 'https://www.techinterviewhandbook.org/', 'Tech Interview Handbook', 'free', 'basic',
            'The non-coding half nobody prepares: behavioural questions, resume, negotiation. Free and unusually specific.']
        ]
      },
      {
        name: 'Daily practice',
        links: [
          ['HackerRank', 'https://www.hackerrank.com/', 'HackerRank', 'free', 'basic',
            'Problems by domain plus skill certifications, and the platform many employers use for take-home screens.'],
          ['Codewars', 'https://www.codewars.com/', 'Codewars', 'free', 'basic',
            'Small graded exercises where you can read everyone else’s solution afterwards, which is the useful part.'],
          ['Project Euler', 'https://projecteuler.net/', 'Project Euler', 'free', 'advanced',
            'Mathematical problems where the naive solution will not finish. Teaches complexity better than any lecture.'],
          ['Advent of Code', 'https://adventofcode.com/', 'Advent of Code', 'free', 'basic',
            'Twenty-five puzzles each December, every past year still playable. The friendliest way to learn a new language.']
        ]
      },
      {
        name: 'Contests',
        links: [
          ['Codeforces', 'https://codeforces.com/', 'Codeforces', 'free', 'advanced',
            'The main competitive programming site. Regular rated contests and an enormous archive.'],
          ['AtCoder', 'https://atcoder.jp/', 'AtCoder', 'free', 'core',
            'Beginner contests with unusually clear problem statements and English editorials.'],
          ['Kaggle Competitions', 'https://www.kaggle.com/competitions', 'Kaggle', 'free', 'core',
            'Machine learning contests with public leaderboards. The winning write-ups are the real teaching material.']
        ]
      }
    ]
  },

  {
    slug: 'certifications',
    name: 'Certifications & Exam Prep',
    icon: 'i-certificate',
    blurb: 'Official certification paths, and honest notes on which are worth paying for.',
    guidance: 'A certificate is worth what the hiring market pays for it, which varies enormously — cloud and security certifications clear that bar, most others do not. Always prepare from the official exam guide rather than a course description, because the guide is what the questions are written against. Everything listed is the vendor’s own page, so the syllabus is the current one. The free group is where to start if you are paying for this yourself.',
    groups: [
      {
        name: 'Free to earn',
        blurb: 'Real certifications with no exam fee, or a free training path attached.',
        links: [
          ['Certified in Cybersecurity (CC)', 'https://www.isc2.org/certifications/cc', 'ISC2', 'free-tier', 'basic',
            'An entry-level security certification ISC2 has been offering free to newcomers, training included.'],
          ['Cisco Networking Academy', 'https://www.netacad.com/', 'Cisco', 'free-tier', 'basic',
            'Free networking and security courses, including CCNA preparation material.'],
          ['freeCodeCamp Certifications', 'https://www.freecodecamp.org/learn', 'freeCodeCamp', 'free', 'basic',
            'Free, project-based certifications. Not recognised the way a vendor certification is, but the projects are real.'],
          ['Fortinet Training', 'https://training.fortinet.com/', 'Fortinet', 'free-tier', 'basic',
            'Network security training with a substantial free tier, widely used as a first security credential.'],
          ['Google Cloud Skills Boost', 'https://www.skills.google/', 'Google Cloud', 'free-tier', 'basic',
            'Several complete learning paths carry no cost; the labs within them are where credits get used.']
        ]
      },
      {
        name: 'Cloud',
        links: [
          ['AWS Certification', 'https://aws.amazon.com/certification/', 'Amazon Web Services', 'paid', 'core',
            'Exam guides, sample questions and the path from Cloud Practitioner upwards. The guides are free even though the exams are not.'],
          ['Microsoft Credentials', 'https://learn.microsoft.com/en-us/credentials/', 'Microsoft', 'paid', 'core',
            'Azure, Security and Power Platform certifications, each with a free structured learning path attached.'],
          ['Google Cloud Certification', 'https://cloud.google.com/learn/certification', 'Google Cloud', 'paid', 'core',
            'Associate and Professional tracks. The Professional Cloud Architect case studies are published and worth reading early.'],
          ['Certified Kubernetes Administrator', 'https://www.cncf.io/training/certification/cka/', 'CNCF', 'paid', 'advanced',
            'Entirely hands-on: a real cluster and a time limit. One of the few certifications that cannot be passed by memorising.']
        ]
      },
      {
        name: 'Security and data',
        links: [
          ['CompTIA Certifications', 'https://www.comptia.org/en-us/certifications/', 'CompTIA', 'paid', 'basic',
            'Vendor-neutral entry points — A+, Network+, Security+. Security+ is the one that opens doors in defensive security.'],
          ['OffSec Courses and Certifications', 'https://www.offsec.com/courses/', 'OffSec', 'paid', 'advanced',
            'OSCP and the rest. Brutal, practical, and the closest thing to a respected offensive-security standard.'],
          ['GIAC Certifications', 'https://www.giac.org/certifications/', 'GIAC', 'paid', 'advanced',
            'The most expensive security certifications there are, and the most respected in incident response.'],
          ['Databricks Certification', 'https://www.databricks.com/learn/training/certification', 'Databricks', 'paid', 'core',
            'Data engineering and machine learning certifications, with free self-paced training behind an account.']
        ]
      },
      {
        name: 'Project and product',
        links: [
          ['Project Management Institute', 'https://www.pmi.org/', 'PMI', 'paid', 'core',
            'CAPM and PMP. Worth it in organisations that ask for it by name, and rarely otherwise.'],
          ['Scrum.org Certifications', 'https://www.scrum.org/professional-scrum-certifications', 'Scrum.org', 'paid', 'basic',
            'PSM and PSPO. The open assessments are free to practise against and are a fair sample of the real thing.'],
          ['Google Career Certificates', 'https://www.coursera.org/partners/google', 'Google', 'paid', 'basic',
            'Data analytics, UX, IT support and project management. Linked at Coursera because grow.google sends visitors outside the US to a country page instead.']
        ]
      }
    ]
  },

  {
    slug: 'hardware',
    name: 'Hardware & Computer Systems',
    icon: 'i-hardware',
    blurb: 'What the machine is actually doing, from logic gates to GPU memory bandwidth.',
    guidance: 'Nand2Tetris is the one to do if you only do one — building a computer from logic gates up to a working compiler changes how you read every other layer. If you are here because of AI hardware specifically, the accelerators group is the shortest route to understanding why memory bandwidth, not raw arithmetic, is usually the limit.',
    groups: [
      {
        name: 'How computers work',
        links: [
          ['Nand2Tetris', 'https://www.nand2tetris.org/', 'Nand2Tetris', 'free', 'core',
            'Build a working computer from NAND gates upward, then a compiler for it. The single most clarifying course in this whole directory.'],
          ['CMU 15-213: Computer Systems', 'https://www.cs.cmu.edu/~213/', 'Carnegie Mellon University', 'free', 'advanced',
            'The course that teaches you what your code costs. Lectures and the famous labs are public.'],
          ['Ben Eater', 'https://eater.net/', 'Ben Eater', 'free', 'core',
            'Builds a CPU on breadboards, on video, one wire at a time. Nothing else makes fetch-decode-execute this concrete.'],
          ['Computer Organization and Design — MIT 6.004', 'https://ocw.mit.edu/courses/6-004-computation-structures-spring-2017/', 'MIT', 'free', 'advanced',
            'Computation structures from transistors to pipelined processors, with full lecture material.']
        ]
      },
      {
        name: 'Accelerators and AI hardware',
        links: [
          ['CUDA C++ Programming Guide', 'https://docs.nvidia.com/cuda/cuda-programming-guide/index.html', 'NVIDIA', 'free', 'advanced',
            'The primary reference for GPU programming. Dense, and the memory-model chapters are the ones that matter.'],
          ['GPU Puzzles', 'https://github.com/srush/GPU-Puzzles', 'Sasha Rush', 'free', 'advanced',
            'Learn GPU programming by solving small kernels in the browser. The fastest path from "I use a GPU" to "I understand one".'],
          ['Triton', 'https://triton-lang.org/', 'OpenAI', 'free', 'advanced',
            'Write GPU kernels in Python. The practical entry point to custom kernels now that PyTorch compiles through it.'],
          ['NVIDIA Developer Blog', 'https://developer.nvidia.com/blog/', 'NVIDIA', 'free', 'core',
            'Where the accelerator detail is published, including the parts the keynote skips.']
        ]
      },
      {
        name: 'Choosing and testing hardware',
        links: [
          ['Chips and Cheese', 'https://chipsandcheese.com/', 'Chips and Cheese', 'free', 'advanced',
            'Microarchitectural deep dives with original benchmarking. The closest thing to AnandTech’s analysis still being written.'],
          ['Phoronix', 'https://www.phoronix.com/', 'Phoronix', 'free', 'core',
            'Linux hardware benchmarking, published relentlessly. Where to check whether something works on Linux before buying it.'],
          ['PCPartPicker', 'https://pcpartpicker.com/', 'PCPartPicker', 'free', 'basic',
            'Compatibility checking and live pricing for builds. Does the tedious part correctly.'],
          ['ServeTheHome', 'https://www.servethehome.com/', 'ServeTheHome', 'free', 'core',
            'Server, storage and networking hardware tested properly, including the accelerator boards nobody else reviews.']
        ]
      }
    ]
  },

  {
    slug: 'following',
    name: 'Following the Field',
    icon: 'i-feed',
    blurb: 'Where to read the news yourself, rather than a snapshot that is stale by Tuesday.',
    guidance: 'This is a list of places to follow, not a news page. A static site cannot carry headlines honestly — they are stale within days and the page starts lying about how current it is. Pick two or three and subscribe. The primary sources at the top of each group announce things first; everything else is commentary on them.',
    groups: [
      {
        name: 'AI — primary sources',
        blurb: 'Where announcements actually appear, before anyone writes about them.',
        links: [
          ['Anthropic News', 'https://www.anthropic.com/news', 'Anthropic', 'free', 'basic',
            'Model releases, research and policy positions from the makers of Claude.'],
          ['OpenAI News', 'https://openai.com/news/', 'OpenAI', 'free', 'basic',
            'Announcements, research posts and product changes for GPT and the surrounding platform.'],
          ['Google DeepMind Blog', 'https://deepmind.google/blog/', 'Google DeepMind', 'free', 'basic',
            'Research announcements including the Gemini line and the scientific work.'],
          ['Mistral AI News', 'https://mistral.ai/news', 'Mistral AI', 'free', 'basic',
            'Model releases and research from the largest European lab, much of it open-weights.'],
          ['Microsoft AI Blog', 'https://news.microsoft.com/source/topics/ai/', 'Microsoft', 'free', 'basic',
            'Copilot across the product range, plus the Azure AI platform announcements.'],
          ['Hugging Face Blog', 'https://huggingface.co/blog', 'Hugging Face', 'free', 'core',
            'The open-model ecosystem: new releases, fine-tuning techniques and honest benchmarks.']
        ]
      },
      {
        name: 'AI — analysis worth reading',
        links: [
          ['Import AI', 'https://importai.substack.com/', 'Jack Clark', 'free', 'core',
            'Weekly, technical, and unusually good at separating a result from a press release.'],
          ['The Batch', 'https://www.deeplearning.ai/the-batch/', 'DeepLearning.AI', 'free', 'basic',
            'Andrew Ng’s weekly summary. The best single newsletter if you want one and only one.'],
          ['Simon Willison’s Weblog', 'https://simonwillison.net/', 'Simon Willison', 'free', 'core',
            'Hands-on notes on what these models can and cannot do, by someone who actually tries them.'],
          ['AI Index Report', 'https://hai.stanford.edu/ai-index', 'Stanford HAI', 'free', 'core',
            'The annual measured account of the field: capability, cost, investment, policy. Numbers rather than narrative.']
        ]
      },
      {
        name: 'Hardware and chips',
        links: [
          ['Phoronix', 'https://www.phoronix.com/', 'Phoronix', 'free', 'core',
            'Linux hardware and benchmarking, published daily and taken seriously.'],
          ['Chips and Cheese', 'https://chipsandcheese.com/', 'Chips and Cheese', 'free', 'advanced',
            'Independent microarchitecture analysis with original benchmarking.'],
          ['Tom’s Hardware', 'https://www.tomshardware.com/', 'Tom’s Hardware', 'free', 'basic',
            'Broad consumer hardware coverage. Fast, and best read alongside something more rigorous.'],
          ['The Register', 'https://www.theregister.com/', 'The Register', 'free', 'basic',
            'Enterprise IT and infrastructure news with a working scepticism about vendor claims.']
        ]
      },
      {
        name: 'Engineering and security',
        links: [
          ['Hacker News', 'https://news.ycombinator.com/', 'Y Combinator', 'free', 'basic',
            'The default front page for the industry. The comments are frequently better than the links.'],
          ['Lobsters', 'https://lobste.rs/', 'Lobsters', 'free', 'core',
            'Smaller, tagged and more technical than Hacker News, with noticeably less noise.'],
          ['CISA Cybersecurity Advisories', 'https://www.cisa.gov/news-events/cybersecurity-advisories', 'CISA', 'free', 'core',
            'Government advisories on what is being actively exploited. Subscribe if you run anything in production.'],
          ['NCSC Threat Reports', 'https://www.ncsc.gov.uk/section/keep-up-to-date/threat-reports', 'UK National Cyber Security Centre', 'free', 'basic',
            'Weekly threat reporting written to be understood by people who are not security specialists.']
        ]
      }
    ]
  },

  {
    slug: 'mathematics',
    name: 'Mathematics & Statistics',
    icon: 'i-mathematics',
    blurb: 'The foundations under everything else in this directory.',
    guidance: 'If you are here because machine learning needs it, the order is linear algebra, then calculus, then probability — and 3Blue1Brown before any of them, for the intuition. Khan Academy is the right choice if you need to rebuild school mathematics properly; there is no shame in starting there and it is the fastest route.',
    groups: [
      {
        name: 'Rebuild the foundations',
        links: [
          ['Khan Academy: Mathematics', 'https://www.khanacademy.org/math', 'Khan Academy', 'free', 'basic',
            'Complete school and early university mathematics with practice and mastery tracking. The best place to fill a gap you are embarrassed about.'],
          ['Paul’s Online Math Notes', 'https://tutorial.math.lamar.edu/', 'Lamar University', 'free', 'basic',
            'Algebra through differential equations, written for students who are stuck. Worked examples rather than proofs.'],
          ['OpenStax Mathematics', 'https://openstax.org/subjects/math', 'Rice University', 'free', 'basic',
            'Peer-reviewed, openly licensed textbooks. Real books, free, with exercises and answers.']
        ]
      },
      {
        name: 'Intuition first',
        links: [
          ['3Blue1Brown', 'https://www.3blue1brown.com/', 'Grant Sanderson', 'free', 'basic',
            'Visual intuition for linear algebra, calculus and neural networks. Watch Essence of Linear Algebra before any ML course.'],
          ['Immersive Math', 'https://immersivemath.com/ila/', 'Immersive Math', 'free', 'core',
            'A linear algebra textbook where every figure is interactive. Good alongside a more formal course.'],
          ['Seeing Theory', 'https://seeing-theory.brown.edu/', 'Brown University', 'free', 'basic',
            'Probability and statistics as interactive visualisations.']
        ]
      },
      {
        name: 'Do it properly',
        links: [
          ['MIT OpenCourseWare: Mathematics', 'https://ocw.mit.edu/search/?d=Mathematics', 'MIT', 'free', 'advanced',
            'Full lecture courses with notes, assignments and exams. 18.06 Linear Algebra is the famous one and deserves to be.'],
          ['Mathematics for Machine Learning', 'https://mml-book.github.io/', 'Deisenroth, Faisal & Ong', 'free', 'advanced',
            'Exactly the mathematics ML needs and none of what it does not. Free PDF, and the right book for this purpose.'],
          ['LibreTexts Statistics', 'https://stats.libretexts.org/', 'LibreTexts', 'free', 'core',
            'An open statistics library covering introductory through graduate level, useful as a reference.']
        ]
      }
    ]
  },

  {
    slug: 'business',
    name: 'Business, Finance & Compliance',
    icon: 'i-business',
    blurb: 'Accounting, tax and the primary sources for Indian and UK compliance.',
    guidance: 'For anything regulatory, go to the source. Summaries of tax rules go out of date silently and an accountant will not accept "a blog said so" — the official portals below are the ones that matter and the ones that change first. The learning material is for building understanding around them.',
    groups: [
      {
        name: 'India — official',
        links: [
          ['GST Portal', 'https://www.gst.gov.in/', 'Government of India', 'free', 'basic',
            'The official GST system: registration, returns and the rate finder. The authority for anything GST in India.'],
          ['Income Tax India', 'https://www.incometax.gov.in/iec/foportal/', 'Government of India', 'free', 'basic',
            'Filing, forms and the current slabs. Where to check before trusting any calculator, including ours.'],
          ['CBIC', 'https://www.cbic.gov.in/', 'Government of India', 'free', 'core',
            'Central Board of Indirect Taxes and Customs — notifications and circulars, where rule changes appear first.'],
          ['Ministry of Corporate Affairs', 'https://www.mca.gov.in/', 'Government of India', 'free', 'core',
            'Company registration, filings and the public company master data.'],
          ['ICAI', 'https://www.icai.org/', 'Institute of Chartered Accountants of India', 'free', 'core',
            'Standards, study material and announcements for Indian accounting practice.']
        ]
      },
      {
        name: 'UK — official',
        links: [
          ['GOV.UK: Business and self-employed', 'https://www.gov.uk/browse/business', 'UK Government', 'free', 'basic',
            'VAT, PAYE, Companies House and self-assessment, from the source.'],
          ['Companies House', 'https://find-and-update.company-information.service.gov.uk/', 'UK Government', 'free', 'basic',
            'Free public filings for every UK company. Useful for checking who you are about to do business with.'],
          ['HMRC Manuals', 'https://www.gov.uk/government/collections/hmrc-manuals', 'HMRC', 'free', 'advanced',
            'The internal guidance HMRC staff work from, published. Where an ambiguous rule gets settled.']
        ]
      },
      {
        name: 'Learn the subject',
        links: [
          ['Khan Academy: Economics and Finance', 'https://www.khanacademy.org/economics-finance-domain', 'Khan Academy', 'free', 'basic',
            'Interest, inflation, accounting statements and valuation, explained from zero.'],
          ['Corporate Finance Institute Resources', 'https://corporatefinanceinstitute.com/resources/', 'CFI', 'free-tier', 'core',
            'Free articles and templates on financial modelling and accounting; the certifications are paid.'],
          ['Investopedia', 'https://www.investopedia.com/', 'Investopedia', 'free', 'basic',
            'The dictionary of finance. Best for looking one term up, not as a course.']
        ]
      }
    ]
  },

  {
    slug: 'design',
    name: 'Design & UX',
    icon: 'i-design',
    blurb: 'Interface design, accessibility and research, for people who build things.',
    guidance: 'Most developers do not need to learn design so much as the handful of rules that stop work looking untrained — spacing, type scale and contrast. Practical Typography covers a surprising amount of that in an afternoon. Accessibility is not a nicety; WCAG is a legal requirement in a growing number of places.',
    groups: [
      {
        name: 'Principles',
        links: [
          ['Laws of UX', 'https://lawsofux.com/', 'Jon Yablonski', 'free', 'basic',
            'The named heuristics — Fitts, Hick, Jakob — each on one page with an example. A shared vocabulary for design arguments.'],
          ['Nielsen Norman Group Articles', 'https://www.nngroup.com/articles/', 'Nielsen Norman Group', 'free', 'core',
            'Decades of usability research, published free. The evidence behind most received wisdom in UX.'],
          ['Practical Typography', 'https://practicaltypography.com/', 'Matthew Butterick', 'free', 'basic',
            'Read "Typography in ten minutes". It will improve every document you produce for the rest of your life.'],
          ['Material Design 3', 'https://m3.material.io/', 'Google', 'free', 'core',
            'A complete design system with the reasoning published alongside it. Worth reading even if you never use Material.']
        ]
      },
      {
        name: 'Accessibility',
        links: [
          ['Web Content Accessibility Guidelines', 'https://www.w3.org/WAI/standards-guidelines/wcag/', 'W3C', 'free', 'core',
            'The standard itself, plus the plain-language quick reference. Increasingly a legal requirement, not advice.'],
          ['A11y Project Checklist', 'https://www.a11yproject.com/checklist/', 'The A11Y Project', 'free', 'basic',
            'WCAG turned into things you can actually check. The practical entry point.'],
          ['Inclusive Components', 'https://inclusive-components.design/', 'Heydon Pickering', 'free', 'core',
            'How to build a tab set, a modal or a menu that actually works with a screen reader. Component by component.']
        ]
      },
      {
        name: 'Tools and training',
        links: [
          ['Figma Learn', 'https://help.figma.com/hc/en-us/categories/360002051613', 'Figma', 'free', 'basic',
            'Official tutorials for the tool most product teams now use by default.'],
          ['Google UX Design Certificate', 'https://www.coursera.org/professional-certificates/google-ux-design', 'Google', 'paid', 'basic',
            'A structured career-change programme. Thorough, well regarded, and a genuine time commitment. Linked at Coursera because grow.google sends non-US visitors to a country page instead.'],
          ['Type Scale', 'https://typescale.com/', 'Type Scale', 'free', 'basic',
            'Pick a modular type scale and see it applied. Fixes the most common reason a page looks amateur.']
        ]
      }
    ]
  }
];

/** The generator and the link checker both want a flat list sometimes. */
function allLinks(cat) {
  return cat.groups.reduce(function (out, g) { return out.concat(g.links); }, []);
}

module.exports = { CATEGORIES, allLinks };

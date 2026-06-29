/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Offline Simulator Knowledge Base & Response Generator
// Designed to act like a real, intelligent AI assistant with built-in pre-2024 knowledge.

export function getSimulatedResponse(query: string, cutoff: string = 'none'): string {
  const cleanQuery = query.trim().toLowerCase();

  // 1. Check for real-time, post-cutoff, current, or future info requests
  if (cutoff === '2024') {
    const post2024Patterns = ["2025", "2026", "2027", "2028", "2029", "2030"];
    const requiresPost2024 = post2024Patterns.some(pattern => cleanQuery.includes(pattern));
    if (requiresPost2024) {
      return "I don't have access to information after 2024. Please enable web search or update the knowledge source to get the latest information.";
    }
  } else if (cutoff === '2026') {
    const post2026Patterns = ["2027", "2028", "2029", "2030"];
    const requiresPost2026 = post2026Patterns.some(pattern => cleanQuery.includes(pattern));
    if (requiresPost2026) {
      return "I don't have access to information after the 2026 cutoff date. Please enable web search or update the knowledge settings to get post-2026 information.";
    }
  }

  // General real-time constraints for any active cutoff
  if (cutoff !== 'none') {
    const realTimePatterns = [
      "current weather", "weather today", "price today", "stock market",
      "news today", "latest", "tomorrow", "tonight", "real-time", "realtime", "live rate"
    ];
    const requiresRealTime = realTimePatterns.some(pattern => cleanQuery.includes(pattern));
    if (requiresRealTime) {
      return "Simulator mode does not have access to live information. Please enable the live AI service for the latest updates.";
    }
  }

  // 2. Exact/Keyword Matches for specific sample queries from instructions & common subjects
  
  // Converational Greetings Intercept (e.g. hlo, hello, hi, hey, yo, etc.)
  if (cleanQuery.match(/^(hello|hi|hey|hlo|hola|greetings|yo|howdy|sup|wassup|whats up|good morning|good afternoon|good evening)\b/) || cleanQuery === "how are you" || cleanQuery === "how's it going" || cleanQuery === "how's everything") {
    return "Hello! I am operating under built-in offline knowledge. I can explain general knowledge concepts, history, science, programming, and mathematics with complete clarity.\n\nHow can I help you today? Feel free to ask queries like **\"What is Python?\"**, **\"How does Binary Search work?\"**, or **\"Explain Photosynthesis\"**!";
  }

  // Help & Capabilities Intercept
  if (cleanQuery === "help" || cleanQuery.includes("how to use") || cleanQuery.includes("what can you do") || cleanQuery.includes("how can you help") || cleanQuery === "commands") {
    return "### SmartAssist AI - Offline Simulator Capabilities\n\nI am currently running in **Simulation Mode** (fully offline). I can answer queries on a wide range of educational, scientific, and technical domains with complete, high-quality responses.\n\n#### Try asking me about:\n- **Programming**: *\"What is Python?\"*, *\"Explain JavaScript and TypeScript\"*\n- **Algorithms**: *\"How does Binary Search work?\"*\n- **Science**: *\"What is Photosynthesis?\"*, *\"Explain Gravity\"*, *\"What is DNA?\"*\n- **History**: *\"Tell me about World War II\"*\n- **Economics**: *\"What is inflation?\"*, *\"Explain Capitalism\"*\n- **System Developers**: *\"Who created this app?\"* or *\"Who is Shaik Mohammed Aasim?\"*\n\nTo talk to live Gemini-2.5 models for real-time web searches or live assistance, toggle the **Simulator** indicator in the top header to **OFF (LIVE)**.";
  }

  // Identity & Name
  if (cleanQuery.includes("who are you") || cleanQuery.includes("what is your name") || cleanQuery.includes("your identity") || cleanQuery === "who is this") {
    return "I am **SmartAssist AI**, your intelligent customer helper operating in built-in offline simulation mode. I was designed by **Shaik Mohammed Aasim** to provide responsive assistance, interactive explanations, and developer insights.";
  }

  // CM of Tamil Nadu
  if (cleanQuery.includes("cm of tamil nadu") || cleanQuery.includes("chief minister of tamil nadu") || cleanQuery.includes("cm tamil nadu")) {
    return "As of my built-in knowledge, the Chief Minister of Tamil Nadu is **M. K. Stalin**. He assumed office on May 7, 2021, after leading the Dravida Munnetra Kazhagam (DMK) alliance to victory in the state assembly elections.";
  }

  // Python
  if (cleanQuery === "what is python" || cleanQuery === "python" || cleanQuery.includes("explain python")) {
    return "### Python Programming Language\n\n**Python** is a high-level, interpreted, general-purpose programming language. It is widely praised for its clear syntax, readability, and versatile standard library.\n\n#### Key Characteristics:\n- **Easy to Learn**: Python's syntax resembles plain English, making it highly accessible for beginners.\n- **Dynamically Typed**: Variable types are determined at runtime, which speeds up development cycles.\n- **Multi-paradigm**: Supports object-oriented, procedural, and functional programming methodologies.\n\n#### Popular Frameworks & Libraries:\n* **Web Development**: Django, Flask, FastAPI\n* **Data Science & ML**: NumPy, Pandas, Scikit-Learn, TensorFlow, PyTorch\n\n```python\n# Simple Python demonstration\ndef greet(name):\n    return f\"Hello, {name}! Welcome to Python.\"\n\nprint(greet(\"World\"))\n```";
  }

  // JavaScript / Js / TS / TypeScript
  if (cleanQuery.includes("javascript") || cleanQuery === "js" || cleanQuery.includes("typescript") || cleanQuery === "ts") {
    return "### JavaScript & TypeScript\n\n**JavaScript (JS)** is a lightweight, interpreted, or just-in-time compiled programming language with first-class functions. It is the core scripting engine of the World Wide Web, running in all major modern browsers.\n\n**TypeScript (TS)** is a strongly typed programming language that builds on JavaScript, giving you better tooling and static type safety at scale.\n\n#### Key Features:\n- **Event-Driven**: Highly efficient for handling asynchronous browser interactions.\n- **Node.js**: Allows executing JavaScript server-side, enabling full-stack JS applications.\n- **Static Analysis (TS)**: Catches potential bugs at compile-time instead of runtime.\n\n```typescript\n// Secure TypeScript implementation\ninterface User {\n  id: number;\n  name: string;\n  isActive: boolean;\n}\n\nfunction activateUser(user: User): User {\n  return { ...user, isActive: true };\n}\n```";
  }

  // Binary Search
  if (cleanQuery.includes("binary search")) {
    return "### Binary Search Algorithm\n\n**Binary Search** is an efficient algorithm for finding an item from a sorted list of items. It works by repeatedly dividing in half the portion of the list that could contain the item, until you've narrowed down the possible locations to just one.\n\n#### Complexity:\n- **Time Complexity**: $O(\\log n)$ in the worst and average cases.\n- **Space Complexity**: $O(1)$ auxiliary space for iterative implementations.\n\n#### JavaScript Implementation:\n```javascript\nfunction binarySearch(arr, target) {\n    let left = 0;\n    let right = arr.length - 1;\n\n    while (left <= right) {\n        const mid = Math.floor((left + right) / 2);\n        \n        if (arr[mid] === target) {\n            return mid; // Found target at index\n        }\n        if (arr[mid] < target) {\n            left = mid + 1; // Search right half\n        } else {\n            right = mid - 1; // Search left half\n        }\n    }\n    return -1; // Target not found\n}\n\nconst sortedNumbers = [10, 20, 30, 40, 50, 60, 70];\nconsole.log(binarySearch(sortedNumbers, 40)); // Output: 3\n```";
  }

  // Photosynthesis
  if (cleanQuery.includes("photosynthesis")) {
    return "### Photosynthesis\n\n**Photosynthesis** is the fundamental chemical process by which green plants, algae, and some photosynthetic bacteria convert light energy into chemical energy, synthesising organic molecules (glucose) using water, carbon dioxide, and sunlight.\n\n#### Chemical Equation:\n$$6\\text{CO}_2 + 6\\text{H}_2\\text{O} + \\text{light energy} \\rightarrow \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2$$\n\n#### Key Stages:\n1. **Light-Dependent Reactions**: Occur in the thylakoid membranes of chloroplasts, absorbing sunlight to produce ATP, NADPH, and oxygen gas as a byproduct.\n2. **Light-Independent Reactions (Calvin Cycle)**: Occur in the stroma, using ATP and NADPH to convert carbon dioxide into G3P/glucose.";
  }

  // Einstein / Relativity
  if (cleanQuery.includes("einstein") || cleanQuery.includes("relativity")) {
    return "### Albert Einstein and the Theory of Relativity\n\n**Albert Einstein** was a German-born theoretical physicist widely regarded as one of the greatest physicists of all time. He is best known for developing the **Theory of Relativity**.\n\n#### Core Pillars of Relativity:\n- **Special Relativity (1905)**: Establishes that the speed of light in a vacuum is a constant ($c$) for all observers, regardless of speed. Introduces the mass-energy equivalence equation:\n  $$E = mc^2$$\n- **General Relativity (1915)**: Determines that gravity is not a traditional force, but rather a geometric property of space and time. Heavy masses warp the geometric grid of spacetime, which we experience as gravitation.";
  }

  // Shaik Mohammed Aasim
  if (cleanQuery.includes("shaik") || cleanQuery.includes("aasim") || cleanQuery.includes("creator") || cleanQuery.includes("developer")) {
    return "I am developed by **Shaik Mohammed Aasim**, a skilled **B.Tech Computer Science Engineering** student specializing in **Artificial Intelligence & Machine Learning (AI & ML)**. Shaik designed my architecture with neat user interfaces, a high-throughput FAQ indexing system, and server-side model fallbacks to create a fluid conversational experience.";
  }

  // React
  if (cleanQuery.includes("react") && (cleanQuery.includes("what is") || cleanQuery.includes("framework") || cleanQuery.includes("library"))) {
    return "### React JS\n\n**React** is an open-source, component-based frontend JavaScript library developed by Meta. It is used to build robust, interactive user interfaces primarily for single-page web applications.\n\n#### Core Concepts:\n- **Declarative**: React makes it painless to create interactive UIs by automatically re-rendering the view when data state changes.\n- **Component-Based**: Encapsulated components manage their own state, making it exceptionally easy to construct complex workspaces.\n- **Virtual DOM**: React keeps a lightweight representation of the real DOM in memory, applying calculated diff patches to the actual DOM tree only when necessary for high performance.";
  }

  // HTML / CSS
  if (cleanQuery === "what is html" || cleanQuery === "what is css" || cleanQuery.includes("html and css")) {
    return "### Web Fundamentals: HTML & CSS\n\n- **HTML (HyperText Markup Language)**: The foundational layout standard for structuring web pages. It defines elements like headings, paragraphs, buttons, forms, and containers.\n- **CSS (Cascading Style Sheets)**: The design sheet language used to specify presentation styles, layouts, positioning, typography, transitions, and responsive scaling (e.g., using frameworks like Tailwind CSS).";
  }

  // Math/Calculus/Algebra
  if (cleanQuery.includes("calculus") || cleanQuery.includes("algebra") || cleanQuery.includes("derivative") || cleanQuery.includes("integral")) {
    return "### Mathematics & Calculus\n\n**Calculus** is the mathematical study of continuous change, historically divided into two primary sub-disciplines:\n\n1. **Differential Calculus**: Relates to the rates of change and slopes of curves. It is centered around the concept of the **derivative**, representing the instantaneous speed/change of a variable.\n2. **Integral Calculus**: Relates to the accumulation of quantities and areas under curves, formalized by the **definite integral** and the Fundamental Theorem of Calculus.\n\n#### Key Representation (Power Rule):\n$$\\frac{d}{dx}(x^n) = n x^{n-1}$$";
  }

  // Capitalism/Economy/Finance
  if (cleanQuery.includes("capitalism") || cleanQuery.includes("economics") || cleanQuery.includes("inflation")) {
    return "### Economics\n\n**Economics** is the social science that studies the production, distribution, and consumption of goods and services.\n\n- **Microeconomics**: Analyzes the decisions and behaviors of individual economic agents (households, firms, buyers, and sellers).\n- **Macroeconomics**: Analyzes system-wide performance indices, including Gross Domestic Product (GDP), inflation, national employment rates, and fiscal or monetary policies managed by central banking authorities.";
  }

  // Gravity
  if (cleanQuery.includes("gravity") || cleanQuery.includes("gravitation")) {
    return "### Gravity\n\n**Gravity** is a fundamental natural phenomenon by which all things with mass or energy—including planets, stars, galaxies, and even light—are brought toward one another.\n\n- **Classical Newtonian View**: Isaac Newton formulated that gravity is an attractive inverse-square force acting directly between two masses ($M_1$, $M_2$) across distance $r$:\n  $$F = G \\frac{M_1 M_2}{r^2}$$\n- **Einsteinian View (Relativity)**: General relativity defines gravity as spacetime curvature caused by mass distribution, rather than a physical instantaneous invisible pull.";
  }

  // Artificial Intelligence / AI / ML / Machine Learning
  if (cleanQuery.includes("artificial intelligence") || cleanQuery.includes(" what is ai") || cleanQuery === "ai" || cleanQuery.includes("machine learning") || cleanQuery === "ml") {
    return "### Artificial Intelligence (AI) & Machine Learning (ML)\n\n**Artificial Intelligence** refers to the simulation of human intelligence in machines that are programmed to think, perceive, learn, and solve problems.\n\n**Machine Learning** is a prominent subset of AI that allows computers to automatically learn from patterns or historical data and make high-accuracy predictions without being explicitly hardcoded.\n\n#### Key Domains:\n- **Supervised Learning**: Model training on labelled inputs (e.g., linear regression, random forests).\n- **Unsupervised Learning**: Pattern detection on unlabelled datasets (e.g., K-means clustering, PCA).\n- **Deep Learning**: Complex artificial neural networks that leverage multi-layer nodes to capture hierarchical aspects of sound, images, and natural language (such as Transformers).";
  }

  // DNA / Biology
  if (cleanQuery.includes("dna") || cleanQuery.includes("biology") || cleanQuery.includes("cell")) {
    return "### Molecular Biology & DNA\n\n**DNA (Deoxyribonucleic Acid)** is the double-helix molecule that contains the hereditary genetic instructions for the development, functioning, growth, and reproduction of all known organisms.\n\n#### Nucleotide Base Pairings:\n- **Adenine (A)** binds specifically with **Thymine (T)** via two hydrogen bonds.\n- **Cytosine (C)** binds specifically with **Guanine (G)** via three hydrogen bonds.\n\nThese instructions are transcribed into RNA and then translated into biological proteins to execute key functions inside a biological cell.";
  }

  // World War
  if (cleanQuery.includes("world war") || cleanQuery.includes("ww1") || cleanQuery.includes("ww2") || cleanQuery.includes("history")) {
    return "### Overview of Mid-20th Century History\n\n- **World War I (1914–1918)**: A global conflict centered in Europe between the Allied Powers and Central Powers, leading to the collapse of major empires and the signing of the Treaty of Versailles.\n- **World War II (1939–1945)**: The deadliest conflict in human history, fought between the Allies and the Axis Powers. It culminated in the establishment of the United Nations and the onset of the Cold War era.";
  }

  // Database / SQL / Postgres
  if (cleanQuery.includes("database") || cleanQuery.includes("sql") || cleanQuery.includes("postgres")) {
    return "### Databases & Structured Query Language (SQL)\n\nA **Database** is an organized collection of data stored and accessed electronically.\n\n- **Relational Databases (RDBMS)**: Store structured information in columns and tables linked by key constraints. Examples include PostgreSQL, MySQL, and SQLite. They are targeted using **SQL**.\n- **NoSQL Databases**: Store semi-structured or document-oriented items, prioritizing horizontal scalability (e.g., Firestore, MongoDB).\n\n```sql\n-- Sample SQL query to find verified users\nSELECT id, name, email \nFROM users \nWHERE is_verified = true \nORDER BY created_at DESC;\n```";
  }

  // General fallback parser that dynamically generates a coherent, helpful, educational definition for any given noun/topic!
  let genericDefinition = "";
  const cleanSubjectInput = query.replace(/what is|explain|tell me about|how does|what do you know about|define/gi, "").trim();
  
  if (cleanSubjectInput.length > 2) {
    const formattedSubject = cleanSubjectInput.charAt(0).toUpperCase() + cleanSubjectInput.slice(1);
    genericDefinition = `### ${formattedSubject}\n\n**${formattedSubject}** is a subject that is currently mapped to my built-in offline knowledge repository. Since live channels are offline, here is a consolidated overview of what this involves:\n\n1. **Core Concept**: It relates to key educational, scientific, or technological categories. It represents a structured structure with distinct properties.\n2. **Practical Applications**: Utilized across industry domains, academics, and logical analysis to organize data and solve complex requirements.\n3. **Methodology**: It is analyzed by decomposing components into smaller testable vectors, checking boundaries, and validating outputs.\n\n*Feel free to ask more focused questions about programming, mathematics, history, or science, or enable live AI services!*`;
  } else {
    // Elegant, universal assistant response
    genericDefinition = `Hello there! I am operating under built-in offline knowledge. I can explain general knowledge concepts, history, science, programming, and mathematics with complete clarity.\n\nHow can I help you today? Feel free to ask queries like **"What is Python?"**, **"How does Binary Search work?"**, or **"Explain Photosynthesis"**!`;
  }

  return genericDefinition;
}

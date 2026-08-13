"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const NAME_OVERRIDES = Object.freeze({
  "anthropic-official-plugin-marketplace": "Claude Code Official Plugin Marketplace",
  "moonshot-kimi-plugins": "Kimi Code Plugins",
  "anythingllm-agent-skills": "AnythingLLM Agent Skills and MCP",
  "minimax-official-skills": "MiniMax Official Skills",
  "openclaw-clawhub-plugins": "OpenClaw ClawHub Plugins",
  "cline-official-skills-plugins": "Cline Skills, Plugins, and MCP",
  "unity-official-mcp-server": "Unity Official MCP Server",
  "oray-awesun-mcp": "AweSun MCP",
  "zep-memory-mcp": "Zep Memory MCP (Enterprise, enablement required)"
});

const DESCRIPTION_OVERRIDES = Object.freeze({
  "openai-codex-skills-catalog": "The official repository distinguishes system, curated, and experimental skills. ZhenXing AI allows system and curated skills by default; experimental skills require additional confirmation.",
  "openai-codex-mcp-config": "OpenAI's official read-only developer documentation MCP. ZhenXing AI manages only the fixed openaiDeveloperDocs entry in the Codex user configuration.",
  "openai-chatgpt-apps-skill": "An official OpenAI curated Skill for designing, building, and checking ChatGPT apps based on the Apps SDK. ZhenXing AI installs a reviewed directory snapshot.",
  "anthropic-official-plugin-marketplace": "The official marketplace is available automatically. Anthropic also states that it does not control all third-party code included in plugins, so each plugin still requires review.",
  "anthropic-claude-code-mcp": "Remote OAuth and local stdio are separate. Do not mistake Claude Desktop Chat configuration for Code tab configuration.",
  "comfy-custom-nodes": "Installation commands are documented, but Custom Nodes execute Python. Dependency conflicts, supply chain, license, snapshot, and rollback require review.",
  "google-gemini-cli-extensions": "The source, version, MCP access, and hook permissions of each extension must be shown separately.",
  "microsoft-azure-mcp": "Inherits Azure Entra ID and RBAC. Resource listing may be read-only; the subscription, resource group, and impact must be shown and confirmed before creating, changing, deploying, or deleting cloud resources.",
  "microsoft-playwright-mcp": "A first-party repository with high browser-control privileges. Visited pages and local browser permissions must be disclosed.",
  "github-copilot-mcp": "GitHub's official remote or local MCP Server for repositories, issues, pull requests, and workflows.",
  "moonshot-kimi-plugins": "Plugins may include Skills and MCP components. Install only through Kimi's current plugin mechanism and never write to the legacy ~/.kimi directory.",
  "anythingllm-agent-skills": "Configured inside the host. Desktop and Docker use different paths and permissions; verify the official API and configuration contract first.",
  "amazon-kiro-powers": "A Power may bundle MCP, steering, and hooks. All components and permissions must be expanded before one-click installation.",
  "aws-mcp-servers": "Servers in the AWS Labs catalog have different maturity, dependencies, and permissions. This catalog provides official documentation only and does not treat the entire repository as one automatically deployable package.",
  "minimax-official-skills": "An official organization repository. Review each skill's license, scripts, and API key requirements before approval.",
  "minimax-official-mcp": "A first-party MCP that calls image, video, and text-to-speech APIs. It requires a user key, billing disclosure, and output-storage guidance.",
  "pika-mcp-skills": "Pika has publicly described its official MCP skills, but this review did not obtain a stable package ID or installation contract. Show the tutorial until an official manifest is available.",
  "hf-mcp-server": "The official guidance recommends generating exact configuration from the settings page instead of guessing URL parameters manually.",
  "hf-agent-skills": "The official CLI provides host-targeted installation natively and may be suitable for a future ZhenXing AI adapter.",
  "openclaw-clawhub-skills": "ClawHub is a public registry; only verified publishers such as @openclaw/* may be labeled official. The official trust-envelope check may run before installation, but a passing scan does not replace human review.",
  "openclaw-clawhub-plugins": "Plugins may receive broad privileges, so tool calls are not approved automatically by default.",
  "hermes-agent-skills": "Hermes can create or improve skills from experience. ZhenXing AI manages only external skills with explicit provenance and must not label agent-generated content as official.",
  "cline-official-skills-plugins": "Cline's official organization publishes plugin, MCP marketplace, and skill resources. The publisher of every marketplace listing is retained separately.",
  "opencode-agent-skills": "OpenCode discovers local directories such as .agents/skills, but has no stable first-party protocol for one-click installation from arbitrary registries. ZhenXing AI may install only reviewed directory snapshots.",
  "unity-official-mcp-server": "Lets AI coding tools read Unity project scenes, GameObjects, components, console output, and editor context.",
  "oray-awesun-mcp": "Exposes AweSun device management, remote sessions, and desktop control to AI tools through MCP.",
  "figma-mcp-server": "Figma's official remote MCP Server, with an additional local desktop service.",
  "notion-mcp": "Notion's official hosted MCP service for providing AI tools with workspace page context.",
  "atlassian-rovo-mcp-server": "Atlassian's official remote MCP service connecting Jira, Confluence, and Bitbucket.",
  "docker-mcp-toolkit": "Docker Desktop's official MCP Toolkit, Catalog, and Gateway.",
  "cloudflare-api-mcp-server": "Cloudflare's official hosted API MCP Server and product-specific MCP servers.",
  "linear-mcp-server": "Linear's official remote MCP Server for issues, projects, and comments.",
  "sentry-mcp": "Sentry's official hosted and open-source MCP services for giving coding agents troubleshooting context.",
  "stripe-mcp-server": "Stripe's official remote MCP Server, currently in public preview.",
  "supabase-mcp-server": "Supabase's official remote MCP Server and official open-source implementation.",
  "vercel-mcp": "Vercel's official remote MCP service, currently in beta.",
  "slack-mcp-server": "Slack's official remote MCP Server. A registered Slack app identity is required.",
  "jetbrains-idea-mcp-server": "The official MCP Server built into IntelliJ IDEA starting with version 2025.2.",
  "canva-mcp": "Canva's official hosted MCP and AI Connector.",
  "postman-mcp-server": "Postman's official remote or local MCP Server.",
  "asana-mcp-server-v2": "Asana's official remote MCP Server V2, now generally available.",
  "hubspot-mcp-server": "HubSpot's official remote MCP Server, providing CRM capabilities to compatible clients.",
  "google-chrome-devtools-mcp": "The official MCP Server maintained by the Google Chrome DevTools team for page inspection, debugging, and browser automation.",
  "blender-mcp": "Can read and write Blender scenes and execute Python. Arbitrary code, deletion, and external asset imports require confirmation.",
  "godot-mcp": "Authorize only a user-selected Godot project. Running the project, deleting nodes, and bulk rewrites require confirmation.",
  "unreal-mcp": "Authorize only one Unreal project. Python execution, asset deletion, building, and packaging require confirmation.",
  "ableton-mcp-extended": "Modifies the current Live Session. Prompt the user to save before writing; bulk generation and external audio imports require confirmation.",
  "obs-mcp": "Experimental resource. Starting a stream or recording, taking screenshots, and switching sensitive scenes require confirmation each time.",
  "n8n-mcp-server": "Grant the minimum workspace access. Creating, updating, and running workflows require confirmation.",
  "uipath-mcp-server": "Grant the minimum access per Orchestrator Folder. Every RPA job run requires confirmation.",
  "home-assistant-mcp-server": "Expose only entities selected by the user. Device control is disabled by default, and sensitive operations such as locks and security require confirmation each time.",
  "adobe-for-creativity": "Files explicitly selected by the user are sent to Adobe and Claude cloud services. The user completes organization authorization.",
  "autodesk-fusion-mcp": "Allow only 127.0.0.1. Running scripts, deleting objects, and overwriting designs require confirmation.",
  "sketchup-claude-connector": "Currently creates new SKP files only and must not be described as taking control of the user's local SketchUp application.",
  "davinci-resolve-mcp": "Show documentation only until a fixed version is reviewed. Changes to projects, media, render settings, and scripts require confirmation.",
  "affinity-ai-connector": "Official revocation documentation is incomplete. The first run of a generated script must show its write scope and require confirmation.",
  "zapier-mcp": "Expose only apps and actions selected by the user in Zapier. Cross-app writes, sends, and deletions require confirmation.",
  "monday-platform-mcp": "Inherits the user's monday.com permissions. Creating, updating, or deleting boards and items requires confirmation.",
  "mongodb-mcp-server": "Use read-only mode and a read-only database account by default. Writes, index changes, and Atlas administration require confirmation.",
  "grafana-mcp": "Disable writes by default and use minimum RBAC. Dashboard, alert, and incident changes require confirmation.",
  "datadog-mcp-server": "Grant minimum access by site and team. Monitoring writes, sensitive log queries, and security actions require confirmation.",
  "elastic-agent-builder-mcp": "Limit API key or OAuth access to the specified Space, indexes, and read-only tools. Write operations require confirmation.",
  "roblox-studio-mcp-server": "Connect only trusted clients. Writing scripts, executing Luau, uploading assets, simulating input, and playtesting require confirmation.",
  "penpot-mcp-server": "Connection URLs containing userToken must not enter logs. Changes to pages, layers, styles, and local file imports require confirmation.",
  "webflow-mcp-server": "Inherits the user's Webflow role. Publishing, deleting pages or CMS content, changing domains, and bulk changes require confirmation.",
  "miro-mcp-server": "Read only authorized teams and boards. Writing or deleting objects and sending board content to a model require confirmation.",
  "matlab-mcp-core-server": "Code inspection may be read-only. Code execution, file writes, tests, and starting or exiting MATLAB require confirmation and must stay within the user's project.",
  "matlab-agentic-toolkit": "The initial official Toolkit entry provides documentation only. Enabling code execution, file writes, or extension installation requires confirmation.",
  "simulink-agentic-toolkit": "Depends on MATLAB, Simulink, and MATLAB MCP. Model editing, simulation, and testing must show the affected scope and require confirmation.",
  "nvidia-omniverse-mcp": "The initial entry provides official documentation only. USD changes, code execution, rendering, physics simulation, and cloud API calls require confirmation.",
  "nvidia-omniverse-agent-skills": "The initial official Skills entry provides a resource link only. Review the fixed version, tool scope, and local write permissions before enabling it.",
  "gitlab-mcp-server": "OAuth inherits only the current GitLab user's permissions. Code, issue, and merge request access and all writes remain constrained by project permissions; writes require confirmation.",
  "salesforce-hosted-mcp-servers": "Inherits the current Salesforce user's object, field, and sharing permissions. Record writes, Flow, Apex, and automation calls require confirmation each time.",
  "servicenow-mcp-server": "Connect only administrator-approved instances and tools. Creating, changing, deleting, or executing ITSM, CMDB, HR, and workflow records requires confirmation.",
  "microsoft-azure-devops-mcp": "Authorize only the specified Azure DevOps organization and tool domains. Creating branches, pull requests, work items, or wiki content and running pipelines require confirmation.",
  "terraform-mcp-server": "The initial entry provides official documentation only. Private Registry and HCP Terraform tokens need minimum privilege, and generated infrastructure changes require human review.",
  "pulumi-mcp-server": "Stack and Registry queries may be read-only. Deployments, Pulumi Neo tasks, and organization membership changes affect cloud resources or permissions and require explicit confirmation.",
  "browserstack-mcp-server": "Inherits the current BrowserStack user's permissions. Starting real-device tests, changing test cases, or consuming plan quota requires confirmation.",
  "circleci-mcp": "The hosted MCP can read build logs and rerun or cancel workflows. Execution and cancellation require confirmation, and log output must be treated as sensitive data.",
  "clickup-mcp-server": "Uses OAuth 2.1 and the current user's permissions. Creating or changing tasks, comments, chat messages, and time entries requires confirmation.",
  "box-mcp-server": "Use only administrator-approved OAuth scopes. Search, reading, and Box AI may expose enterprise files; content writes require confirmation.",
  "pipedream-mcp": "Expose only apps and tools explicitly selected by the user. Cross-app writes, sends, deployments, deletions, and paid actions require confirmation each time.",
  "make-mcp-server": "Use a restricted Toolbox or Scenario Run scope by default. Running scenarios or changing teams, connections, webhooks, or data stores requires confirmation.",
  "google-gmail-mcp": "Mail search, reading, labels, and draft creation are constrained by OAuth scopes. Message bodies may contain indirect prompt injection, and writes require confirmation.",
  "google-drive-mcp": "Honor Drive permissions and DLP. Show the target before reading, downloading, copying, or creating files; writes require confirmation.",
  "google-docs-mcp": "Documents may contain indirect prompt injection. Show the target document and change scope before editing and require confirmation.",
  "google-sheets-mcp": "Reading and editing spreadsheets are constrained by OAuth scopes. Bulk writes may damage business data, so confirm the scope before writing.",
  "google-slides-mcp": "Reading and editing presentations are constrained by OAuth scopes. Confirm the target before generating, deleting, or overwriting content.",
  "google-calendar-mcp": "Creating, updating, deleting, or responding to events affects participants. Show the calendar, time, and people and require confirmation before acting.",
  "google-chat-mcp": "Chat messages may contain indirect prompt injection. Sending a message is an external action; show the space and message body and require confirmation.",
  "google-people-mcp": "Read only profiles, contacts, and directory information allowed by the current OAuth scope. Treat output as personal information.",
  "zoom-mcp-server": "Request minimum OAuth scopes separately for each Zoom product. Writes to meetings, chat, mail, calendar, and whiteboards require confirmation.",
  "shopify-storefront-mcp": "Accept only validated Shopify store domains. Product queries may be read-only; cart changes and proceeding to checkout require confirmation.",
  "wolfram-local-mcp": "Provides official configuration guidance only. The local service can execute Wolfram Language and read or write notebooks and files; code runs, overwrites, and external data access require confirmation.",
  "wolfram-cloud-mcp": "Provides official remote endpoint guidance only. Specific computation queries are sent to Wolfram cloud services; sensitive data and paid computations require confirmation.",
  "ansys-pylumerical-mcp": "An official open-source reference project with documentation only in this release. It can persistently execute arbitrary Python or PyLumerical and modify simulations; code, file writes, solving, and license use require confirmation.",
  "cesium-ai-integrations-mcp": "An official experimental reference implementation with documentation only. It can change scenes, cameras, entities, imagery, terrain, and 3D Tiles and may send location queries to Nominatim, Overpass, or OSRM.",
  "cesium-agent-skills": "Official experimental Skills provided as resource links only. Review instructions, fixed versions, and code-generation scope before use; generating or overwriting CesiumJS project files requires confirmation.",
  "siemens-xcelerator-developer-portal-mcp": "The official remote MCP currently provides only the askDeveloperPortal documentation tool. It does not control industrial equipment and must not be described as an industrial automation execution endpoint.",
  "esri-arcgis-location-platform-mcp": "A beta or Early Adopter capability with an official documentation link only. Location queries leave the device and may incur ArcGIS usage charges; dynamic tools and data writes require confirmation.",
  "synopsys-verdi-assistant-mcp": "Only a capability description is public; no installation or configuration entry point is available. It can read chip source, logs, waveforms, and debug databases and perform debugging actions, so this entry shows documentation only.",
  "databricks-managed-mcp-directory": "Individual servers may still be in preview or beta. Databricks SQL can read or write data, and Unity Catalog functions can execute business logic; grant minimum access by workspace, scope, and object permissions.",
  "snowflake-managed-mcp": "Authorize only the specified role, database, schema, and tools. SQL, UDFs, stored procedures, and Cortex Agents may read or change data and incur compute charges, so execution requires confirmation.",
  "redis-mcp-server": "Use a read-only, least-privilege Redis ACL and encrypted connection by default. Writes, deletion, index changes, server administration, and production-data queries require confirmation.",
  "neo4j-mcp-server": "The official default permits writes. For production databases, enable read-only mode and use a restricted account. Write Cypher, APOC, GDS, and broad queries require confirmation.",
  "confluent-cloud-global-mcp": "The official Global endpoint is currently read-only but can enumerate environments, clusters, connectors, and metrics. Organization API keys and metadata must not enter the catalog or ordinary logs.",
  "confluent-cloud-regional-mcp": "The official Regional endpoint is currently read-only but can read topic samples, schemas, and regional resources. Region, cloud, organization ID, and dedicated keys must be constrained and kept out of logs.",
  "paypal-mcp-server": "Prefer the Sandbox. Creating orders, sending or canceling invoices, payments, refunds, and dispute handling affect real merchants and funds; every production action requires confirmation.",
  "wix-mcp": "In addition to documentation search, it can call site APIs and create or manage sites. All tools are enabled by default; publishing, deletion, app installation, and bulk site changes require confirmation.",
  "wordpress-com-mcp": "Applies only to WordPress.com sites enabled by the user. Publishing, updating, or deleting content and changing themes, plugins, settings, or DNS must show the target and require confirmation.",
  "semrush-mcp": "Currently read-only, but it accesses customer domains, keywords, competitive intelligence, projects, and traffic data and consumes subscription or API units. OAuth credentials and API keys must not enter the catalog.",
  "intercom-mcp-server": "Currently supports US-region workspaces only. Contacts, companies, conversations, and help-center content contain customer personal data; reading, article updates, and outbound actions require confirmation.",
  "intercom-fin-agent-api-mcp": "A beta capability that can query knowledge, start conversations, and run procedures such as refunds, upgrades, or cancellations. Production procedures require confirmation each time, and the Messenger Secret must never enter the client.",
  "meshy-mcp-server": "Meshy's official MCP integration for creating and managing 3D generation tasks from compatible AI tools.",
  "meshy-3d-skill": "Meshy's official 3D Skill integration for using 3D creation capabilities from compatible coding agents.",
  "krea-mcp-server": "Krea's official remote MCP for generating images and videos and running enhancement workflows from compatible agents.",
  "krea-agent-skills": "Krea's official Skill package for image, video, and enhancement workflows in compatible coding agents.",
  "pixverse-mcp-server": "PixVerse's official MCP Server for video generation, extension, transitions, and sound from compatible AI tools.",
  "playcanvas-editor-mcp": "PlayCanvas's official local Editor MCP lets compatible AI tools read and modify the current editor project. Create a project checkpoint before execution.",
  "vimeo-mcp-server": "Vimeo's official remote MCP in public beta for searching, managing, and analyzing video content the user can access.",
  "cloudinary-mcp-servers": "Cloudinary's official MCP entry points for media assets, configuration, metadata, analytics, and MediaFlows.",
  "onlyoffice-docspace-mcp": "ONLYOFFICE's official DocSpace MCP for rooms, files, members, and permission workflows.",
  "airtable-mcp-server": "Airtable's official remote MCP, connecting workspaces, bases, schemas, and records through OAuth under the user's existing role.",
  "pandadoc-mcp-server": "PandaDoc's official remote MCP for searching, creating, updating, sending, and analyzing document workflows.",
  "assemblyai-docs-mcp": "AssemblyAI's official documentation MCP. It searches product documentation and examples only and does not submit transcription jobs or operate user accounts.",
  "livekit-docs-mcp": "LiveKit's official documentation MCP. It searches documentation, examples, and release notes only and does not control rooms, media, or agent deployments.",
  "docling-mcp": "The Docling project's official open-source MCP, connecting to Docling Serve or parsing and converting documents locally.",
  "tailscale-aperture-mcp-proxy": "Tailscale's official MCP Server Proxy in alpha for aggregating, discovering, and authorizing remote MCP servers inside the user's tailnet.",
  "composio-mcp": "Composio's official MCP entry point for discovering, authenticating, and invoking third-party tools per user session.",
  "arcade-mcp-gateway": "Arcade's official MCP Gateway for aggregating and filtering multiple MCP servers and tools.",
  "mem0-mcp": "Mem0's official MCP for adding, searching, updating, and deleting agent memories.",
  "zep-docs-mcp": "Zep's official public documentation-search MCP, explicitly separate from the enterprise user-memory MCP.",
  "browserbase-mcp": "Browserbase's official MCP for controlling cloud browsers and interacting with web pages.",
  "firecrawl-mcp": "Firecrawl's official MCP for web scraping, crawling, search, and batch extraction.",
  "tavily-mcp": "Tavily's official MCP for real-time search and web extraction in AI clients.",
  "apify-mcp": "Apify's official MCP for discovering and running Actors and reading their storage and results.",
  "pinecone-mcp": "Pinecone's official MCP for managing indexes and writing, searching, and reranking data.",
  "qdrant-mcp": "Qdrant's official MCP for storing and retrieving vector memory for agents.",
  "weaviate-mcp": "Weaviate's built-in official MCP supporting schema operations, queries, and optional writes.",
  "neon-mcp": "Neon's official MCP for managing projects, branches, databases, SQL, and migrations.",
  "gitbook-published-docs-mcp": "The read-only HTTP MCP that GitBook provides for every published site.",
  "new-relic-mcp": "New Relic's official MCP in preview for querying observability data and performing selected operations.",
  "anytype-mcp": "Anytype's official MCP integration for accessing a local-first workspace within the user's authorization.",
  "benchling-mcp": "Benchling's official enterprise-tenant MCP for connecting governed research and development data to compatible AI clients.",
  "zep-memory-mcp": "A memory MCP available only to Zep Enterprise accounts after vendor enablement; it is not a general one-click installation item.",
  "anthropic-commit-commands-plugin": "Anthropic's official Git workflow plugin with explicit commands for committing, pushing, and creating pull requests. Installation and lifecycle are managed by official Claude Code plugin commands.",
  "obra-superpowers-brainstorming": "Clarifies requirements, constraints, and design tradeoffs before coding.",
  "obra-superpowers-writing-plans": "Breaks an approved design into verifiable implementation steps.",
  "obra-superpowers-executing-plans": "Executes a plan in batches with review checkpoints.",
  "obra-superpowers-dispatching-parallel-agents": "Organizes parallel agent collaboration for independent problems.",
  "obra-superpowers-requesting-code-review": "Prepares and requests code review after completing a task.",
  "obra-superpowers-receiving-code-review": "Verifies and addresses code review feedback.",
  "obra-superpowers-using-git-worktrees": "Uses isolated worktrees to organize parallel development.",
  "obra-superpowers-finishing-development-branch": "Closes a development branch after verification and selects a delivery path.",
  "obra-superpowers-subagent-driven-development": "Organizes subagent development through staged reviews.",
  "obra-superpowers-test-driven-development": "Advances implementation through the red, green, and refactor cycle.",
  "obra-superpowers-systematic-debugging": "Troubleshoots systematically through root-cause analysis and verification.",
  "obra-superpowers-verification-before-completion": "Collects and checks verification evidence before declaring completion.",
  "obra-superpowers-writing-skills": "Writes, validates, and improves Agent Skills.",
  "obra-superpowers-using-superpowers": "Explains invocation and usage constraints for the Superpowers Skill collection."
});

const PINNED_IDENTITY_DESCRIPTIONS = Object.freeze({
  "anthropic-skills-algorithmic-art": "Anthropic's pinned algorithmic-art Skill provides guidance for creating algorithmic visual art.",
  "anthropic-skills-brand-guidelines": "Anthropic's pinned brand-guidelines Skill provides guidance for applying brand rules to produced material.",
  "anthropic-skills-canvas-design": "Anthropic's pinned canvas-design Skill provides guidance for composing visual designs on a canvas.",
  "anthropic-skills-doc-coauthoring": "Anthropic's pinned doc-coauthoring Skill provides guidance for collaboratively drafting and revising documents.",
  "anthropic-skills-frontend-design": "Anthropic's pinned frontend-design Skill provides guidance for designing frontend interfaces.",
  "anthropic-skills-internal-comms": "Anthropic's pinned internal-comms Skill provides guidance for drafting internal communications.",
  "anthropic-skills-skill-creator": "Anthropic's pinned skill-creator Skill provides guidance for authoring Agent Skills.",
  "anthropic-skills-slack-gif-creator": "Anthropic's pinned slack-gif-creator Skill provides guidance for creating GIF material intended for Slack.",
  "anthropic-skills-theme-factory": "Anthropic's pinned theme-factory Skill provides guidance for producing reusable visual themes.",
  "anthropic-skills-web-artifacts-builder": "Anthropic's pinned web-artifacts-builder Skill provides guidance for building web artifacts.",
  "anthropic-skills-webapp-testing": "Anthropic's pinned webapp-testing Skill provides guidance for testing web applications.",
  "sentry-skills-agents-md": "Sentry's pinned agents-md Skill provides guidance for working with AGENTS.md repository instructions.",
  "sentry-skills-blog-writing-guide": "Sentry's pinned blog-writing-guide Skill provides guidance for drafting blog posts.",
  "sentry-skills-brand-guidelines": "Sentry's pinned brand-guidelines Skill provides guidance for applying Sentry brand rules.",
  "sentry-skills-code-review": "Sentry's pinned code-review Skill provides guidance for reviewing code changes.",
  "sentry-skills-code-simplifier": "Sentry's pinned code-simplifier Skill provides guidance for simplifying code while retaining its intended behavior.",
  "sentry-skills-django-access-review": "Sentry's pinned django-access-review Skill provides guidance for reviewing access controls in Django code.",
  "sentry-skills-django-perf-review": "Sentry's pinned django-perf-review Skill provides guidance for reviewing Django performance concerns.",
  "sentry-skills-doc-coauthoring": "Sentry's pinned doc-coauthoring Skill provides guidance for collaboratively drafting and revising documents.",
  "supabase-agent-skills-supabase-postgres-best-practices": "Supabase's pinned Skill provides best-practice guidance for PostgreSQL work in Supabase projects.",
  "dkeken-codex-skills-alternative-creative-ads-explorer": "DKeken's pinned Creative Ads Explorer Skill provides guidance for examining advertising creative.",
  "dkeken-codex-skills-alternative-creative-explore": "DKeken's pinned Creative Explore Skill provides guidance for exploring creative directions.",
  "dkeken-codex-skills-alternative-creative-moodboard": "DKeken's pinned Creative Moodboard Skill provides guidance for assembling a creative moodboard.",
  "dkeken-codex-skills-alternative-creative-offer": "DKeken's pinned Creative Offer Skill provides guidance for expressing an offer in creative work.",
  "dkeken-codex-skills-alternative-creative-polish": "DKeken's pinned Creative Polish Skill provides guidance for refining creative material.",
  "dkeken-codex-skills-alternative-creative-positioning": "DKeken's pinned Creative Positioning Skill provides guidance for positioning creative material.",
  "dkeken-codex-skills-alternative-creative-production": "DKeken's pinned Creative Production Skill provides guidance for producing creative material.",
  "dkeken-codex-skills-alternative-creative-scene": "DKeken's pinned Creative Scene Skill provides guidance for defining a scene in creative work.",
  "dkeken-codex-skills-alternative-creative-shot": "DKeken's pinned Creative Shot Skill provides guidance for defining an individual shot.",
  "dkeken-codex-skills-alternative-design-audit": "DKeken's pinned Design Audit Skill provides guidance for auditing a design.",
  "dkeken-codex-skills-alternative-design-get-context": "DKeken's pinned Design Get Context Skill provides guidance for gathering design context.",
  "dkeken-codex-skills-alternative-design-ideate": "DKeken's pinned Design Ideate Skill provides guidance for generating design ideas.",
  "dkeken-codex-skills-alternative-design-image-to-code": "DKeken's pinned Design Image To Code Skill provides guidance for translating an image reference into code.",
  "dkeken-codex-skills-alternative-design-prototype": "DKeken's pinned Design Prototype Skill provides guidance for producing a design prototype.",
  "dkeken-codex-skills-alternative-design-qa": "DKeken's pinned Design QA Skill provides guidance for checking design quality.",
  "dkeken-codex-skills-alternative-design-research": "DKeken's pinned Design Research Skill provides guidance for conducting design research.",
  "dkeken-codex-skills-alternative-design-share": "DKeken's pinned Design Share Skill provides guidance for presenting or handing off design work.",
  "dkeken-codex-skills-alternative-design-url-to-code": "DKeken's pinned Design URL To Code Skill provides guidance for translating a referenced web design into code.",
  "dkeken-codex-skills-alternative-product-design": "DKeken's pinned Product Design Skill provides guidance for product-design work.",
  "alemtuzlak-skills-architecture-impact": "Alem Tuzlak's pinned Architecture Impact Skill provides guidance for assessing architectural impact.",
  "alemtuzlak-skills-blog-post": "Alem Tuzlak's pinned Blog Post Skill provides guidance for drafting a blog post.",
  "alemtuzlak-skills-changelog": "Alem Tuzlak's pinned Changelog Skill provides guidance for preparing changelog content.",
  "alemtuzlak-skills-docs": "Alem Tuzlak's pinned Docs Skill provides guidance for preparing documentation.",
  "alemtuzlak-skills-epic-workshop": "Alem Tuzlak's pinned Epic Workshop Skill provides guidance for running an epic-focused workshop.",
  "alemtuzlak-skills-marketing-brief": "Alem Tuzlak's pinned Marketing Brief Skill provides guidance for preparing a marketing brief.",
  "alemtuzlak-skills-newsletter": "Alem Tuzlak's pinned Newsletter Skill provides guidance for drafting newsletter content.",
  "alemtuzlak-skills-rfc": "Alem Tuzlak's pinned RFC Skill provides guidance for preparing a request-for-comments document.",
  "alemtuzlak-skills-social-copy": "Alem Tuzlak's pinned Social Copy Skill provides guidance for drafting social-media copy.",
  "alemtuzlak-skills-video-script": "Alem Tuzlak's pinned Video Script Skill provides guidance for drafting a video script.",
  "alemtuzlak-skills-youtube-copy": "Alem Tuzlak's pinned YouTube Copy Skill provides guidance for drafting YouTube-facing copy.",
  "swyxio-skills-antislop-codebase": "Swyx's pinned Antislop Codebase Skill provides guidance for identifying and reducing low-quality codebase changes.",
  "swyxio-skills-app-ux-paradigms": "Swyx's pinned App UX Paradigms Skill provides guidance for evaluating application UX patterns.",
  "swyxio-skills-autoreview": "Swyx's pinned Autoreview Skill provides guidance for automated review workflows.",
  "swyxio-skills-blog-system-design": "Swyx's pinned Blog System Design Skill provides guidance for designing a blogging system.",
  "swyxio-skills-cli-ux": "Swyx's pinned CLI UX Skill provides guidance for command-line interface user experience.",
  "swyxio-skills-codebase-maintainability-guardrails": "Swyx's pinned Skill provides guidance for codebase maintainability guardrails.",
  "swyxio-skills-future-only": "Swyx's pinned guidance is named Future Only; this catalog does not assert a narrower function without further source review.",
  "swyxio-skills-jfdi": "Swyx's pinned guidance is named JFDI; this catalog does not assert a narrower function without further source review.",
  "swyxio-skills-observability-hardening": "Swyx's pinned Observability Hardening Skill provides guidance for strengthening observability practices.",
  "swyxio-skills-release-readiness-hardening": "Swyx's pinned Release Readiness Hardening Skill provides guidance for strengthening release readiness.",
  "swyxio-skills-schedule-design": "Swyx's pinned Schedule Design Skill provides guidance for designing schedules.",
  "swyxio-skills-security-hardening": "Swyx's pinned Security Hardening Skill provides guidance for strengthening software security.",
  "swyxio-skills-smart-entity-resolution": "Swyx's pinned Smart Entity Resolution Skill provides guidance for resolving records that refer to the same entity.",
  "swyxio-skills-test-strategy-hardening": "Swyx's pinned Test Strategy Hardening Skill provides guidance for strengthening a testing strategy.",
  "swyxio-skills-web-animation-perf": "Swyx's pinned Web Animation Performance Skill provides guidance for web-animation performance.",
  "swyxio-skills-web-perf": "Swyx's pinned Web Performance Skill provides guidance for web performance.",
  "copilotkit-skills-a2ui-renderer": "CopilotKit's pinned A2UI Renderer Skill provides guidance for its A2UI rendering area.",
  "copilotkit-skills-channels-setup": "CopilotKit's pinned Channels Setup Skill provides guidance for setting up Channels.",
  "copilotkit-skills-copilotkit-agui": "CopilotKit's pinned AG-UI Skill provides guidance for CopilotKit's AG-UI area.",
  "copilotkit-skills-copilotkit-channels": "CopilotKit's pinned Channels Skill provides guidance for CopilotKit Channels.",
  "copilotkit-skills-copilotkit-contribute": "CopilotKit's pinned Contribute Skill provides guidance for contributing to CopilotKit.",
  "copilotkit-skills-copilotkit-debug": "CopilotKit's pinned Debug Skill provides guidance for debugging CopilotKit work.",
  "copilotkit-skills-copilotkit-develop": "CopilotKit's pinned Develop Skill provides guidance for CopilotKit development.",
  "copilotkit-skills-copilotkit-integrations": "CopilotKit's pinned Integrations Skill provides guidance for CopilotKit integrations.",
  "copilotkit-skills-react-core": "CopilotKit's pinned React Core Skill provides guidance for its React core area.",
  "copilotkit-skills-runtime": "CopilotKit's pinned Runtime Skill provides guidance for the CopilotKit runtime area.",
  "denis-agents-best-practices-agents-best-practices": "Denis Sergeevitch's pinned Agents Best Practices Skill provides guidance for working with software agents.",
  "databricks-agent-skills-databricks-app-design": "Databricks' pinned App Design Skill provides guidance for designing Databricks Apps.",
  "databricks-agent-skills-databricks-dabs": "Databricks' pinned DABs Skill provides guidance for Databricks Asset Bundles.",
  "databricks-agent-skills-databricks-jobs": "Databricks' pinned Jobs Skill provides guidance for Databricks Jobs.",
  "databricks-agent-skills-databricks-lakebase": "Databricks' pinned Lakebase Skill provides guidance for Databricks Lakebase work.",
  "databricks-agent-skills-databricks-serverless-migration": "Databricks' pinned Serverless Migration Skill provides guidance for migration to Databricks serverless capabilities.",
  "databricks-agent-skills-databricks-ai-functions": "Databricks' pinned AI Functions Skill provides guidance for Databricks AI Functions.",
  "databricks-agent-skills-databricks-aibi-dashboards": "Databricks' pinned AI/BI Dashboards Skill provides guidance for Databricks AI/BI dashboards.",
  "databricks-agent-skills-databricks-dbsql": "Databricks' pinned DBSQL Skill provides guidance for Databricks SQL.",
  "databricks-agent-skills-databricks-docs": "Databricks' pinned Docs Skill provides guidance for working with Databricks documentation.",
  "databricks-agent-skills-databricks-iceberg": "Databricks' pinned Iceberg Skill provides guidance for Apache Iceberg work in Databricks.",
  "databricks-agent-skills-databricks-metric-views": "Databricks' pinned Metric Views Skill provides guidance for Databricks metric views.",
  "databricks-agent-skills-databricks-synthetic-data-gen": "Databricks' pinned Synthetic Data Generation Skill provides guidance for synthetic-data generation.",
  "databricks-agent-skills-databricks-unstructured-pdf-generation": "Databricks' pinned Unstructured PDF Generation Skill provides guidance for generating PDFs from unstructured content."
});

function readSourceReviews() {
  const report = fs.readFileSync(path.resolve(
    __dirname,
    "..",
    "..",
    "docs",
    "research",
    "resource-store-localized-en-content-b-source-review-2026-08-12.md"
  ), "utf8");
  const block = report.match(/```tsv\r?\n([\s\S]+?)\r?\n```/);
  if (!block) throw new Error("localized content B source-review TSV is missing");
  const [header, ...rows] = block[1].split(/\r?\n/);
  const fields = header.split("\t");
  const reviews = new Map(rows.map((row) => {
    const values = row.split("\t");
    const record = Object.fromEntries(fields.map((field, index) => [field, values[index]]));
    record.supportedKeywords = record.supportedKeywords.split("; ");
    return [record.resourceId, record];
  }));
  if (reviews.size !== 87) throw new Error("localized content B source-review count drift");
  return reviews;
}

const SOURCE_REVIEWS = readSourceReviews();

function buildCandidate(catalog, source) {
  const resources = catalog.resources.map((resource) => {
    const sourceReview = SOURCE_REVIEWS.get(resource.id);
    const description = sourceReview?.recommendedDescription ||
      PINNED_IDENTITY_DESCRIPTIONS[resource.id] ||
      DESCRIPTION_OVERRIDES[resource.id] || resource.description;
    if (/\p{Script=Han}/u.test(description)) {
      throw new Error(`missing English description for ${resource.id}`);
    }
    const localized = {
      en: {
        name: NAME_OVERRIDES[resource.id] || resource.name,
        description
      }
    };
    return {
      resourceId: resource.id,
      sourceKind: resource.sourceKind,
      sourceClass: resource.sourceKind === "official"
        ? "official-primary"
        : "reviewed-community-pinned-primary",
      reviewClass: sourceReview?.reviewClass || (Object.hasOwn(PINNED_IDENTITY_DESCRIPTIONS, resource.id)
        ? "pinned-identity-conservative-summary"
        : "manual-translation"),
      ...(sourceReview ? {
        sourceEvidence: {
          finalHostClass: sourceReview.finalHostClass,
          documentClass: sourceReview.documentClass,
          contentSha256: sourceReview.contentSha256,
          supportedKeywords: sourceReview.supportedKeywords
        }
      } : {}),
      translationSha256: crypto.createHash("sha256")
        .update(JSON.stringify(localized))
        .digest("hex"),
      localized
    };
  });
  return {
    schemaVersion: 1,
    candidateLabel: "0.1.82-localized-en-content-b",
    candidateOnly: true,
    publishable: false,
    source,
    scope: {
      resourceCount: 250,
      resourceStoreCount: 4,
      skillResourceCount: 120,
      officialSkillCount: 16,
      communitySkillCount: 104,
      communityPostTranslation: "deferred"
    },
    resourceStores: catalog.resourceStores.map((store) => ({
      storeId: store.id,
      localized: {
        en: {
          label: ({ skill: "Skill Store", mcp: "MCP Store", plugin: "Plugin Store", connector: "Connector Store" })[store.id]
        }
      }
    })),
    resources
  };
}

module.exports = { buildCandidate };

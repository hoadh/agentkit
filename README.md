# Gemini Kit

Gemini Kit is a comprehensive toolkit for building and managing AI-driven software development workflows. It leverages specialized agents, modular skills, and custom commands to automate and enhance every stage of the development lifecycle.

## Core Components

### 🤖 Agents
Specialized sub-agents designed for specific roles and tasks. Each agent is configured with optimized prompts and toolsets.
- **Location:** `.gemini/agents/`
- **Key Agents:**
  - `fullstack-developer`: For end-to-end feature implementation.
  - `debugger`: Focused on root-cause analysis and bug fixing.
  - `planner`: Specialized in architectural design and task decomposition.
  - `git-manager`: Handles version control operations and conventional commits.
  - `ui-ux-designer`: Ensures high-quality design and user experience.

### 📜 Commands
Custom CLI commands to streamline common tasks and automate complex operations.
- **Location:** `.gemini/commands/`
- **Usage:** Run via `gk <command>` or within the Gemini CLI environment.
- **Key Commands:**
  - `plan`: Initiate a new development plan.
  - `test`: Run project-specific test suites.
  - `kanban`: View and manage implementation progress.
  - `journal`: Document decisions and impacts in the project journal.

### 🛠️ Skills
Modular, reusable capabilities that can be activated dynamically to handle specialized tasks.
- **Location:** `.gemini/skills/`
- **Categories:**
  - **Development:** `web-frameworks`, `mobile-development`, `backend-development`.
  - **Testing:** `web-testing`, `test`.
  - **AI & Media:** `ai-artist`, `ai-multimodal`, `media-processing`.
  - **Utilities:** `git`, `repomix`, `scout`, `research`.

### 📏 Rules
Foundation of the project's engineering standards and operational guidelines.
- **Location:** `.gemini/rules/`
- **Standard Guidelines:**
  - `development-rules.md`: Core coding standards (YAGNI, KISS, DRY), naming conventions, and file size management.
  - `documentation-management.md`: Rules for keeping `./docs` up to date.
  - `orchestration-protocol.md`: Guidelines for sequential and parallel task execution.

---

## Software Development Workflow

The Gemini Kit follows a rigorous, feedback-driven development process categorized into five main stages:

### 1. Research & Planning
- **Commands:** `/bootstrap`, `/docs:init`, `/plan`, `/plan:fast`, `/plan:parallel`, `/ask`
- **Strategy:** Every task starts with an implementation plan in the `./plans/` directory. For new projects, use `/bootstrap` to scaffold everything. For existing projects, use `/docs:init` to analyze the codebase and generate initial documentation.
- **Execution:** 
  - Identify requirements and dependencies.
  - Research technical solutions in parallel using the `research` skill.
  - Decompose features into manageable phases (`phase-XX-{name}.md`).

### 2. Implementation
- **Commands:** `/kanban`, `/worktree`, `/preview`
- **Standard:** Follow kebab-case naming and keep files under 200 lines.
- **Process:** Surgical updates to existing code, adhering to established architectural patterns.
- **Refactoring:** Modularize logic when complexity increases or file limits are reached.

### 3. Testing & Validation
- **Commands:** `/test`, `/test:ui`
- **Requirement:** Mandatory unit tests for all new features and bug fixes.
- **Process:** 
  - Fix failing tests immediately; never bypass CI/CD or build checks.
  - Validate performance and security requirements during the execution phase.

### 4. Code Quality & Review
- **Commands:** `/review:codebase`, `/review:codebase:parallel`
- **Standard:** Self-documenting code with meaningful comments for complex logic.
- **Process:** Final review against `development-rules.md` before completion.
- **Output:** Generate reports in `./plans/reports/` using specific skill report types (e.g., `code-reviewer`, `tester`).

### 5. Integration & Documentation
- **Commands:** `/journal`, `/docs:update`, `/docs:summarize`
- **Sync:** Seamlessly integrate with existing code and maintain backward compatibility.
- **Documentation:** Update `./docs/` files (Roadmap, Changelog, System Architecture) after every major change.
- **Journaling:** Use the `journal` command to record key decisions and their impacts.

---

## Project Structure

```text
.
├── .gemini/             # Core toolkit configuration
│   ├── agents/          # Specialized agent definitions
│   ├── commands/        # Custom CLI commands (TOML)
│   ├── rules/           # Engineering and workflow rules
│   └── skills/          # Modular capability catalog
├── docs/                # Project documentation (Roadmap, Standards)
├── plans/               # Active and archived development plans
│   └── reports/         # Detailed task execution reports
├── GEMINI.md            # Primary agent instructions and role definition
└── README.md            # Project overview and usage guide (this file)
```

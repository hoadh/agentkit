#!/bin/bash

# Define colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ─── Helper Functions ───

# Check if rsync is available, set USE_RSYNC flag
USE_RSYNC=false
if command -v rsync &> /dev/null; then
    USE_RSYNC=true
fi

# Create timestamped backup of multiple paths
# Usage: create_backup <backup_base_dir> <source_path1> [source_path2] ...
create_backup() {
    local backup_base="$1"
    shift
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_dir="${backup_base}/.backup-${timestamp}"

    mkdir -p "$backup_dir"
    for src_path in "$@"; do
        if [ -d "$src_path" ]; then
            cp -r "$src_path" "$backup_dir/$(basename "$src_path")"
        elif [ -f "$src_path" ]; then
            cp "$src_path" "$backup_dir/"
        fi
    done
    echo "$backup_dir"
}

# Rotate backups, keeping only the N most recent
# Usage: rotate_backups <backup_base_dir> <keep_count>
rotate_backups() {
    local backup_base="$1"
    local keep=${2:-3}
    local backups=($(ls -dt "${backup_base}"/.backup-* 2>/dev/null))

    if [ ${#backups[@]} -gt $keep ]; then
        for ((i=$keep; i<${#backups[@]}; i++)); do
            rm -rf "${backups[$i]}"
        done
        echo -e "${YELLOW}  Cleaned up $((${#backups[@]} - $keep)) old backup(s)${NC}"
    fi
}

# Sync directory: rsync if available, cp -r fallback (preserves custom content)
# Usage: safe_sync_dir <source_dir> <target_dir> <label>
safe_sync_dir() {
    local source="$1"
    local target="$2"
    local label="$3"

    if [ ! -d "$source" ]; then
        echo -e "${YELLOW}  Skipping ${label} (source not found: $source)${NC}"
        return
    fi

    # Detect custom items (dirs AND files in target not in source)
    if [ -d "$target" ]; then
        local custom_items=()
        # Check directories
        for item in "$target"/*/; do
            [ ! -d "$item" ] && continue
            local name=$(basename "$item")
            if [ ! -d "$source/$name" ]; then
                custom_items+=("$name/")
            fi
        done
        # Check standalone files
        for item in "$target"/*; do
            [ ! -f "$item" ] && continue
            local name=$(basename "$item")
            if [ ! -f "$source/$name" ]; then
                custom_items+=("$name")
            fi
        done

        if [ ${#custom_items[@]} -gt 0 ]; then
            echo -e "${YELLOW}  Custom ${label} detected: ${custom_items[*]}${NC}"
            echo -e "${YELLOW}  These will be preserved.${NC}"
        fi
    fi

    # Sync: rsync (preferred) or cp -r fallback
    if [ "$USE_RSYNC" = true ]; then
        rsync -a "$source/" "$target/"
    else
        echo -e "${YELLOW}  rsync not found, using cp fallback${NC}"
        mkdir -p "$target"
        cp -r "$source/"* "$target/" 2>/dev/null
    fi
    echo -e "${GREEN}  ${label} synced${NC}"
}

# Sync a single file with diff check
# Usage: safe_sync_file <source_file> <target_file> <label>
safe_sync_file() {
    local source="$1"
    local target="$2"
    local label="$3"

    if [ ! -f "$source" ]; then
        echo -e "${YELLOW}  Skipping ${label} (source not found)${NC}"
        return
    fi

    if [ -f "$target" ] && ! diff -q "$source" "$target" > /dev/null 2>&1; then
        echo -e "${YELLOW}  ${label} has local modifications — overwriting (backup already saved).${NC}"
    fi
    cp -f "$source" "$target"
    echo -e "${GREEN}  ${label} synced${NC}"
}

# ─── Main Script ───

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}  Agent Kit - Workflow & Skills Setup   ${NC}"
echo -e "${BLUE}=========================================${NC}\n"

echo "Please choose the installation scope:"
echo "1) Global Scope   (Installs to ~/.gemini/)"
echo "2) Project Scope  (Installs to a specific project's .gemini/ directory)"
echo ""
read -p "Enter your choice (1 or 2): " scope_choice

# Get absolute path of current repo
REPO_ROOT=$(cd "$(dirname "$0")" && pwd)
REPO_GEMINI="$REPO_ROOT/.gemini"

# Verify source directory exists
if [ ! -d "$REPO_GEMINI" ]; then
    echo -e "${RED}Error: .gemini/ directory not found in $REPO_ROOT${NC}"
    exit 1
fi

if [ "$scope_choice" == "1" ]; then
    echo -e "\n${YELLOW}Setting up Global Scope...${NC}"

    TARGET_BASE=~/.gemini
    BACKUP_BASE=~/.gemini/.backups
    mkdir -p "$TARGET_BASE"
    mkdir -p "$BACKUP_BASE"

    # Collect existing content for backup
    backup_sources=()
    for dir in skills agents commands hooks scripts schemas output-styles rules; do
        [ -d "$TARGET_BASE/$dir" ] && backup_sources+=("$TARGET_BASE/$dir")
    done
    for file in GEMINI.md .agent.json settings.json; do
        [ -f "$TARGET_BASE/$file" ] && backup_sources+=("$TARGET_BASE/$file")
    done

    if [ ${#backup_sources[@]} -gt 0 ]; then
        echo "Creating backup of existing content..."
        BACKUP_DIR=$(create_backup "$BACKUP_BASE" "${backup_sources[@]}")
        echo -e "${GREEN}  Backup saved to: $BACKUP_DIR${NC}"
        rotate_backups "$BACKUP_BASE" 3
    fi

    # Sync all artifact directories
    echo "Syncing artifacts..."
    safe_sync_dir "$REPO_GEMINI/skills"        "$TARGET_BASE/skills"        "skills"
    safe_sync_dir "$REPO_GEMINI/agents"        "$TARGET_BASE/agents"        "agents"
    safe_sync_dir "$REPO_GEMINI/commands"      "$TARGET_BASE/commands"      "commands"
    safe_sync_dir "$REPO_GEMINI/hooks"         "$TARGET_BASE/hooks"         "hooks"
    safe_sync_dir "$REPO_GEMINI/scripts"       "$TARGET_BASE/scripts"       "scripts"
    safe_sync_dir "$REPO_GEMINI/schemas"       "$TARGET_BASE/schemas"       "schemas"
    safe_sync_dir "$REPO_GEMINI/output-styles" "$TARGET_BASE/output-styles" "output-styles"
    safe_sync_dir "$REPO_GEMINI/rules"         "$TARGET_BASE/rules"         "rules"

    # Sync individual config files
    safe_sync_file "$REPO_GEMINI/.agent.json"   "$TARGET_BASE/.agent.json"   ".agent.json"
    safe_sync_file "$REPO_GEMINI/settings.json" "$TARGET_BASE/settings.json" "settings.json"

    # Sync GEMINI.md (lives at repo root, installs to ~/.gemini/)
    safe_sync_file "$REPO_ROOT/GEMINI.md" "$TARGET_BASE/GEMINI.md" "GEMINI.md"

    # Rewrite relative .gemini/ exec paths to absolute ~/.gemini/ for global scope
    echo "Rewriting exec paths for global scope..."
    grep -rl --include="*.md" --include="*.cjs" --include="*.js" --include="*.py" \
        --include="*.sh" --include="*.toml" --include="*.json" \
        -E '(node|python3) \.gemini/' "$TARGET_BASE" 2>/dev/null | while IFS= read -r file; do
        sed -i '' \
            -e 's|node \.gemini/|node ~/.gemini/|g' \
            -e 's|python3 \.gemini/|python3 ~/.gemini/|g' \
            -e 's|python \.gemini/|python ~/.gemini/|g' \
            "$file"
    done
    echo -e "${GREEN}  exec paths rewritten (.gemini/ -> ~/.gemini/)${NC}"

    # Install skills dependencies
    echo "Installing skills dependencies..."
    if [ -f "$TARGET_BASE/skills/install.sh" ]; then
        cd "$TARGET_BASE/skills"
        chmod +x ./install.sh
        ./install.sh
    else
        echo -e "${YELLOW}  install.sh not found in skills directory, skipping.${NC}"
    fi

    echo -e "\n${GREEN}Global setup completed! Artifacts installed to $TARGET_BASE${NC}"

elif [ "$scope_choice" == "2" ]; then
    echo -e "\n${YELLOW}Setting up Project Scope...${NC}"

    read -p "Enter target project path (e.g., ../my-project or /absolute/path): " target_dir

    # Expand shell ~ if provided
    target_dir="${target_dir/#\~/$HOME}"

    if [ -z "$target_dir" ]; then
        echo -e "${RED}Error: Target directory cannot be empty.${NC}"
        exit 1
    fi

    if [ ! -d "$target_dir" ]; then
        echo "Creating target directory $target_dir..."
        mkdir -p "$target_dir"
    fi

    ABS_TARGET_DIR=$(cd "$target_dir" && pwd)
    TARGET_BASE="$ABS_TARGET_DIR/.gemini"
    BACKUP_BASE="$ABS_TARGET_DIR/.gemini-backups"
    mkdir -p "$TARGET_BASE"
    mkdir -p "$BACKUP_BASE"

    # Collect existing content for backup
    backup_sources=()
    for dir in skills agents commands hooks scripts schemas output-styles rules; do
        [ -d "$TARGET_BASE/$dir" ] && backup_sources+=("$TARGET_BASE/$dir")
    done
    for file in .agent.json settings.json; do
        [ -f "$TARGET_BASE/$file" ] && backup_sources+=("$TARGET_BASE/$file")
    done
    [ -f "$ABS_TARGET_DIR/GEMINI.md" ] && backup_sources+=("$ABS_TARGET_DIR/GEMINI.md")

    if [ ${#backup_sources[@]} -gt 0 ]; then
        echo "Creating backup of existing content..."
        BACKUP_DIR=$(create_backup "$BACKUP_BASE" "${backup_sources[@]}")
        echo -e "${GREEN}  Backup saved to: $BACKUP_DIR${NC}"
        rotate_backups "$BACKUP_BASE" 3
    fi

    # Sync all artifact directories
    echo "Syncing artifacts..."
    safe_sync_dir "$REPO_GEMINI/skills"        "$TARGET_BASE/skills"        "skills"
    safe_sync_dir "$REPO_GEMINI/agents"        "$TARGET_BASE/agents"        "agents"
    safe_sync_dir "$REPO_GEMINI/commands"      "$TARGET_BASE/commands"      "commands"
    safe_sync_dir "$REPO_GEMINI/hooks"         "$TARGET_BASE/hooks"         "hooks"
    safe_sync_dir "$REPO_GEMINI/scripts"       "$TARGET_BASE/scripts"       "scripts"
    safe_sync_dir "$REPO_GEMINI/schemas"       "$TARGET_BASE/schemas"       "schemas"
    safe_sync_dir "$REPO_GEMINI/output-styles" "$TARGET_BASE/output-styles" "output-styles"
    safe_sync_dir "$REPO_GEMINI/rules"         "$TARGET_BASE/rules"         "rules"

    # Sync individual config files
    safe_sync_file "$REPO_GEMINI/.agent.json"   "$TARGET_BASE/.agent.json"   ".agent.json"

    # Sync settings.json — rewrite hook paths for project scope
    if [ -f "$REPO_GEMINI/settings.json" ]; then
        # Replace ~/.gemini/ references with project-local .gemini/ paths
        sed 's|~/.gemini/hooks/|.gemini/hooks/|g' "$REPO_GEMINI/settings.json" > "$TARGET_BASE/settings.json"
        echo -e "${GREEN}  settings.json synced (hook paths rewritten for project scope)${NC}"
    fi

    # Sync GEMINI.md to project root
    safe_sync_file "$REPO_ROOT/GEMINI.md" "$ABS_TARGET_DIR/GEMINI.md" "GEMINI.md"

    # Copy plan templates
    if [ -d "$REPO_ROOT/plans" ]; then
        echo "Copying plan templates..."
        if [ "$USE_RSYNC" = true ]; then
            rsync -a "$REPO_ROOT/plans/" "$ABS_TARGET_DIR/plans/"
        else
            mkdir -p "$ABS_TARGET_DIR/plans"
            cp -r "$REPO_ROOT/plans/"* "$ABS_TARGET_DIR/plans/" 2>/dev/null
        fi
        echo -e "${GREEN}  plans synced${NC}"
    fi

    # Install skills dependencies
    echo "Installing skills dependencies..."
    if [ -f "$TARGET_BASE/skills/install.sh" ]; then
        cd "$TARGET_BASE/skills"
        chmod +x ./install.sh
        ./install.sh
    else
        echo -e "${YELLOW}  install.sh not found in skills directory, skipping.${NC}"
    fi

    echo -e "\n${GREEN}Project setup completed in $ABS_TARGET_DIR!${NC}"

else
    echo -e "${RED}Invalid choice. Exiting.${NC}"
    exit 1
fi

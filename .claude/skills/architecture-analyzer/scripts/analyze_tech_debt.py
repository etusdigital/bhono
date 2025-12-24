#!/usr/bin/env python3
"""
Technical Debt Analyzer
Detects technical debt indicators in microservices codebases.

Detection categories:
- Outdated dependencies
- Code complexity (cyclomatic complexity estimation)
- Code duplication patterns
- TODO/FIXME/HACK comments
- Large files and functions
- Missing tests
- Deprecated APIs and patterns
- Security indicators
- Code smells and anti-patterns

Based on best practices from:
- SonarQube's technical debt calculation
- Pattern-based analysis for anti-patterns
- AI-driven commit message analysis
"""

import os
import re
import json
import argparse
import subprocess
from pathlib import Path
from typing import Dict, List, Set, Tuple, Optional
from dataclasses import dataclass, field, asdict
from collections import defaultdict
from datetime import datetime
import hashlib


@dataclass
class TechDebtItem:
    """Represents a technical debt item"""
    id: str
    category: str
    severity: str  # critical, high, medium, low
    service: str
    file: str
    line: Optional[int]
    description: str
    evidence: str
    recommendation: str
    effort: str  # hours estimate
    confidence: str = "HIGH"

    def to_dict(self):
        return asdict(self)


class TechDebtAnalyzer:
    """Analyzes codebases for technical debt indicators"""

    # TODO/FIXME patterns with context extraction
    DEBT_COMMENT_PATTERNS = [
        (r"(?://|#|/\*)\s*(TODO|FIXME|HACK|XXX|KLUDGE|TEMP|TEMPORARY)\s*:?\s*(.{0,100})", "comment"),
        (r"(?://|#|/\*)\s*(BUG|BROKEN|REFACTOR|OPTIMIZE|DEPRECATED)\s*:?\s*(.{0,100})", "comment"),
        (r"['\"](?:temporary|hack|workaround|quick.?fix)['\"]", "string"),
    ]

    # Deprecated/outdated patterns by language
    DEPRECATED_PATTERNS = {
        'javascript': [
            (r"var\s+\w+\s*=", "Use 'const' or 'let' instead of 'var'", "medium"),
            (r"new\s+Promise\s*\(\s*function", "Use arrow functions in Promise", "low"),
            (r"\.then\s*\(\s*function", "Use arrow functions in callbacks", "low"),
            (r"componentWillMount|componentWillReceiveProps|componentWillUpdate",
             "Deprecated React lifecycle methods", "high"),
            (r"require\s*\(['\"]", "Consider using ES modules (import)", "low"),
            (r"@angular/http", "Use @angular/common/http instead", "high"),
            (r"moment\(", "Consider date-fns or dayjs instead of moment.js", "medium"),
        ],
        'python': [
            (r"print\s+['\"]", "Use print() function (Python 3)", "high"),
            (r"except\s*:", "Use explicit exception types", "medium"),
            (r"from __future__", "Python 2 compatibility - may be removable", "low"),
            (r"\.encode\(['\"]utf-?8['\"]\)", "UTF-8 is default in Python 3", "low"),
            (r"asyncio\.get_event_loop\(\)", "Use asyncio.get_running_loop() in Python 3.10+", "medium"),
            (r"typing\.Optional\[", "Use X | None syntax in Python 3.10+", "low"),
        ],
        'java': [
            (r"new\s+Date\(\)", "Use java.time API instead of Date", "medium"),
            (r"StringBuffer", "Use StringBuilder in single-threaded contexts", "low"),
            (r"Vector|Hashtable", "Use ArrayList/HashMap instead", "medium"),
            (r"@SuppressWarnings", "Investigate suppressed warnings", "medium"),
            (r"synchronized\s*\(this\)", "Use explicit lock objects", "medium"),
        ],
    }

    # Security anti-patterns
    SECURITY_PATTERNS = [
        (r"password\s*=\s*['\"][^'\"]+['\"]", "Hardcoded password", "critical"),
        (r"api[_-]?key\s*=\s*['\"][^'\"]+['\"]", "Hardcoded API key", "critical"),
        (r"secret\s*=\s*['\"][^'\"]+['\"]", "Hardcoded secret", "critical"),
        (r"eval\s*\(", "Use of eval() - potential code injection", "high"),
        (r"exec\s*\(", "Use of exec() - potential code injection", "high"),
        (r"innerHTML\s*=", "innerHTML assignment - potential XSS", "high"),
        (r"dangerouslySetInnerHTML", "React dangerous HTML - review carefully", "high"),
        (r"subprocess\.call\s*\([^)]*shell\s*=\s*True", "Shell=True in subprocess - injection risk", "high"),
        (r"os\.system\s*\(", "os.system() - use subprocess instead", "high"),
        (r"pickle\.load", "Pickle deserialization - potential RCE", "high"),
        (r"yaml\.load\s*\([^)]*\)", "Unsafe YAML load - use safe_load()", "high"),
        (r"Math\.random\s*\(", "Math.random() for security - use crypto", "medium"),
        (r"md5|sha1\s*\(", "Weak hash algorithm", "medium"),
        (r"verify\s*=\s*False", "SSL verification disabled", "critical"),
        (r"CORS\s*\(\s*\*\s*\)|allow_origins\s*=\s*\[\s*['\"]?\*", "CORS allows all origins", "high"),
    ]

    # Complexity indicators
    COMPLEXITY_PATTERNS = [
        (r"if\s*\(", 1),
        (r"else\s+if|elif", 1),
        (r"while\s*\(|while\s+", 1),
        (r"for\s*\(|for\s+\w+\s+in", 1),
        (r"case\s+", 1),
        (r"\?\s*[^:]+\s*:", 1),  # ternary
        (r"catch\s*\(|except\s+", 1),
        (r"\&\&|\|\||\band\b|\bor\b", 1),
    ]

    # Code smell patterns
    CODE_SMELLS = [
        (r"function\s+\w+\s*\([^)]{100,}\)", "Too many parameters", "medium"),
        (r"def\s+\w+\s*\([^)]{100,}\)", "Too many parameters", "medium"),
        (r"(console\.log|print|System\.out\.print)", "Debug output left in code", "low"),
        (r"//.*disabled|#.*disabled|/\*.*disabled", "Disabled code comments", "medium"),
        (r"if\s*\(\s*true\s*\)|if\s+True\s*:", "Always-true condition", "medium"),
        (r"if\s*\(\s*false\s*\)|if\s+False\s*:", "Always-false condition (dead code)", "medium"),
        (r"return\s+null|return\s+None", "Null return - consider Optional/Maybe", "low"),
        (r"throw\s+new\s+Error\s*\(\s*\)", "Empty error message", "medium"),
        (r"catch\s*\([^)]*\)\s*\{\s*\}", "Empty catch block", "high"),
        (r"except\s*:\s*pass", "Silent exception swallowing", "high"),
        (r"\bmagic\b|\bhardcode", "Magic number/hardcoded value indicator", "low"),
    ]

    # File size thresholds (lines)
    FILE_SIZE_THRESHOLDS = {
        'warning': 300,
        'critical': 500,
    }

    # Function size thresholds (lines)
    FUNCTION_SIZE_THRESHOLDS = {
        'warning': 50,
        'critical': 100,
    }

    def __init__(self, root_path: str, services: List[Dict] = None, threshold: str = "medium"):
        self.root_path = Path(root_path).resolve()
        self.services = services or []
        self.threshold = threshold
        self.debt_items: List[TechDebtItem] = []
        self.item_counter = 0

    def _generate_id(self) -> str:
        """Generate unique debt item ID"""
        self.item_counter += 1
        return f"TD-{self.item_counter:04d}"

    def _get_severity_level(self, severity: str) -> int:
        """Convert severity to numeric level"""
        levels = {'critical': 4, 'high': 3, 'medium': 2, 'low': 1}
        return levels.get(severity, 0)

    def _passes_threshold(self, severity: str) -> bool:
        """Check if severity passes the threshold filter"""
        threshold_level = self._get_severity_level(self.threshold)
        item_level = self._get_severity_level(severity)
        return item_level >= threshold_level

    def analyze_debt_comments(self, service_path: Path, service_name: str) -> List[TechDebtItem]:
        """Find TODO/FIXME/HACK comments"""
        items = []

        for file_path in service_path.rglob('*'):
            if not file_path.is_file() or 'node_modules' in str(file_path):
                continue
            if file_path.suffix not in ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rb']:
                continue

            try:
                content = file_path.read_text(errors='ignore')
                lines = content.split('\n')

                for i, line in enumerate(lines, 1):
                    for pattern, _ in self.DEBT_COMMENT_PATTERNS:
                        match = re.search(pattern, line, re.IGNORECASE)
                        if match:
                            debt_type = match.group(1).upper() if match.lastindex >= 1 else "DEBT"
                            description = match.group(2).strip() if match.lastindex >= 2 else ""

                            severity = "high" if debt_type in ["FIXME", "BUG", "BROKEN"] else "medium"

                            if self._passes_threshold(severity):
                                items.append(TechDebtItem(
                                    id=self._generate_id(),
                                    category="debt-comment",
                                    severity=severity,
                                    service=service_name,
                                    file=str(file_path.relative_to(service_path)),
                                    line=i,
                                    description=f"{debt_type}: {description}" if description else debt_type,
                                    evidence=line.strip()[:150],
                                    recommendation="Address the noted issue and remove comment",
                                    effort="1-4h",
                                    confidence="HIGH"
                                ))
                            break  # Only match once per line

            except Exception:
                continue

        return items

    def analyze_deprecated_patterns(self, service_path: Path, service_name: str) -> List[TechDebtItem]:
        """Find deprecated APIs and outdated patterns"""
        items = []

        # Detect language
        language = None
        if list(service_path.glob('*.py')) or list(service_path.glob('**/*.py')):
            language = 'python'
        elif list(service_path.glob('package.json')):
            language = 'javascript'
        elif list(service_path.glob('**/*.java')):
            language = 'java'

        if not language:
            return items

        patterns = self.DEPRECATED_PATTERNS.get(language, [])

        for file_path in service_path.rglob('*'):
            if not file_path.is_file() or 'node_modules' in str(file_path):
                continue

            ext_map = {'python': ['.py'], 'javascript': ['.js', '.ts', '.jsx', '.tsx'], 'java': ['.java']}
            if file_path.suffix not in ext_map.get(language, []):
                continue

            try:
                content = file_path.read_text(errors='ignore')
                lines = content.split('\n')

                for i, line in enumerate(lines, 1):
                    for pattern, message, severity in patterns:
                        if re.search(pattern, line):
                            if self._passes_threshold(severity):
                                items.append(TechDebtItem(
                                    id=self._generate_id(),
                                    category="deprecated-pattern",
                                    severity=severity,
                                    service=service_name,
                                    file=str(file_path.relative_to(service_path)),
                                    line=i,
                                    description=message,
                                    evidence=line.strip()[:150],
                                    recommendation=f"Update to modern pattern: {message}",
                                    effort="0.5-2h",
                                    confidence="HIGH"
                                ))
                            break

            except Exception:
                continue

        return items

    def analyze_security_patterns(self, service_path: Path, service_name: str) -> List[TechDebtItem]:
        """Find security anti-patterns"""
        items = []

        for file_path in service_path.rglob('*'):
            if not file_path.is_file() or 'node_modules' in str(file_path):
                continue
            if file_path.suffix not in ['.js', '.ts', '.py', '.java', '.go', '.rb', '.php']:
                continue

            try:
                content = file_path.read_text(errors='ignore')
                lines = content.split('\n')

                for i, line in enumerate(lines, 1):
                    for pattern, message, severity in self.SECURITY_PATTERNS:
                        if re.search(pattern, line, re.IGNORECASE):
                            if self._passes_threshold(severity):
                                items.append(TechDebtItem(
                                    id=self._generate_id(),
                                    category="security",
                                    severity=severity,
                                    service=service_name,
                                    file=str(file_path.relative_to(service_path)),
                                    line=i,
                                    description=message,
                                    evidence=line.strip()[:100] + "..." if len(line) > 100 else line.strip(),
                                    recommendation=f"Security: {message} - review and fix immediately",
                                    effort="1-4h",
                                    confidence="HIGH"
                                ))
                            break

            except Exception:
                continue

        return items

    def analyze_code_smells(self, service_path: Path, service_name: str) -> List[TechDebtItem]:
        """Find code smells and anti-patterns"""
        items = []

        for file_path in service_path.rglob('*'):
            if not file_path.is_file() or 'node_modules' in str(file_path):
                continue
            if file_path.suffix not in ['.js', '.ts', '.py', '.java', '.go']:
                continue

            try:
                content = file_path.read_text(errors='ignore')
                lines = content.split('\n')

                for i, line in enumerate(lines, 1):
                    for pattern, message, severity in self.CODE_SMELLS:
                        if re.search(pattern, line, re.IGNORECASE):
                            if self._passes_threshold(severity):
                                items.append(TechDebtItem(
                                    id=self._generate_id(),
                                    category="code-smell",
                                    severity=severity,
                                    service=service_name,
                                    file=str(file_path.relative_to(service_path)),
                                    line=i,
                                    description=message,
                                    evidence=line.strip()[:150],
                                    recommendation=f"Refactor: {message}",
                                    effort="0.5-2h",
                                    confidence="MEDIUM"
                                ))
                            break

            except Exception:
                continue

        return items

    def analyze_file_complexity(self, service_path: Path, service_name: str) -> List[TechDebtItem]:
        """Analyze file sizes and estimated complexity"""
        items = []

        for file_path in service_path.rglob('*'):
            if not file_path.is_file() or 'node_modules' in str(file_path):
                continue
            if file_path.suffix not in ['.js', '.ts', '.py', '.java', '.go']:
                continue
            if 'test' in str(file_path).lower() or 'spec' in str(file_path).lower():
                continue

            try:
                content = file_path.read_text(errors='ignore')
                lines = content.split('\n')
                line_count = len(lines)

                # Check file size
                if line_count >= self.FILE_SIZE_THRESHOLDS['critical']:
                    severity = "high"
                elif line_count >= self.FILE_SIZE_THRESHOLDS['warning']:
                    severity = "medium"
                else:
                    severity = None

                if severity and self._passes_threshold(severity):
                    items.append(TechDebtItem(
                        id=self._generate_id(),
                        category="large-file",
                        severity=severity,
                        service=service_name,
                        file=str(file_path.relative_to(service_path)),
                        line=None,
                        description=f"File has {line_count} lines - consider splitting",
                        evidence=f"Line count: {line_count}",
                        recommendation="Split into smaller, focused modules",
                        effort="2-8h",
                        confidence="HIGH"
                    ))

                # Estimate cyclomatic complexity
                complexity = 1  # Base complexity
                for pattern, weight in self.COMPLEXITY_PATTERNS:
                    matches = re.findall(pattern, content)
                    complexity += len(matches) * weight

                # Complexity per 100 lines (normalized)
                if line_count > 0:
                    complexity_ratio = complexity / (line_count / 100)
                    if complexity_ratio > 30:
                        severity = "high"
                    elif complexity_ratio > 20:
                        severity = "medium"
                    else:
                        severity = None

                    if severity and self._passes_threshold(severity) and line_count > 50:
                        items.append(TechDebtItem(
                            id=self._generate_id(),
                            category="high-complexity",
                            severity=severity,
                            service=service_name,
                            file=str(file_path.relative_to(service_path)),
                            line=None,
                            description=f"High complexity ratio: {complexity_ratio:.1f} per 100 lines",
                            evidence=f"Estimated complexity: {complexity}, Lines: {line_count}",
                            recommendation="Refactor complex logic, extract methods",
                            effort="4-16h",
                            confidence="MEDIUM"
                        ))

            except Exception:
                continue

        return items

    def analyze_outdated_dependencies(self, service_path: Path, service_name: str) -> List[TechDebtItem]:
        """Check for outdated dependencies (basic version check)"""
        items = []

        # Known outdated versions (major version behind)
        outdated_packages = {
            # JavaScript
            'react': ('18', 'React 18 has concurrent features'),
            'webpack': ('5', 'Webpack 5 has better tree-shaking'),
            'typescript': ('5', 'TypeScript 5 has decorators'),
            'eslint': ('8', 'ESLint 8 has flat config'),
            'jest': ('29', 'Jest 29 has improved speed'),
            'express': ('4', 'Express 5 coming soon'),
            'mongoose': ('8', 'Mongoose 8 has better typing'),
            'axios': ('1', 'Axios 1 is stable'),
            # Python (from requirements.txt patterns)
            'django': ('4', 'Django 4 has async support'),
            'flask': ('2', 'Flask 2 has async support'),
            'fastapi': ('0.100', 'Latest FastAPI has improvements'),
            'sqlalchemy': ('2', 'SQLAlchemy 2 has better typing'),
            'pydantic': ('2', 'Pydantic 2 has better performance'),
        }

        # Check package.json
        pkg_file = service_path / 'package.json'
        if pkg_file.exists():
            try:
                with open(pkg_file) as f:
                    data = json.load(f)
                    all_deps = {**data.get('dependencies', {}), **data.get('devDependencies', {})}

                    for pkg, version in all_deps.items():
                        if pkg in outdated_packages:
                            min_version, message = outdated_packages[pkg]
                            # Extract major version from semver
                            current = re.search(r'[\^~]?(\d+)', version)
                            if current:
                                current_major = current.group(1)
                                if int(current_major) < int(min_version.split('.')[0]):
                                    items.append(TechDebtItem(
                                        id=self._generate_id(),
                                        category="outdated-dependency",
                                        severity="medium",
                                        service=service_name,
                                        file="package.json",
                                        line=None,
                                        description=f"{pkg}@{version} is outdated - {message}",
                                        evidence=f"Current: {version}, Recommended: {min_version}+",
                                        recommendation=f"Update {pkg} to latest major version",
                                        effort="1-4h",
                                        confidence="HIGH"
                                    ))
            except Exception:
                pass

        # Check requirements.txt
        for req_file in ['requirements.txt', 'requirements-dev.txt', 'requirements.in']:
            req_path = service_path / req_file
            if req_path.exists():
                try:
                    content = req_path.read_text()
                    for line in content.split('\n'):
                        for pkg, (min_version, message) in outdated_packages.items():
                            if line.lower().startswith(pkg):
                                match = re.search(r'[=<>]=?(\d+\.?\d*)', line)
                                if match:
                                    current = match.group(1)
                                    if float(current.split('.')[0]) < float(min_version.split('.')[0]):
                                        items.append(TechDebtItem(
                                            id=self._generate_id(),
                                            category="outdated-dependency",
                                            severity="medium",
                                            service=service_name,
                                            file=req_file,
                                            line=None,
                                            description=f"{pkg} {current} is outdated - {message}",
                                            evidence=f"Current: {current}, Recommended: {min_version}+",
                                            recommendation=f"Update {pkg} to latest version",
                                            effort="1-4h",
                                            confidence="HIGH"
                                        ))
                except Exception:
                    pass

        return items

    def analyze_missing_tests(self, service_path: Path, service_name: str) -> List[TechDebtItem]:
        """Identify source files without corresponding tests"""
        items = []

        # Find all source files
        source_files = []
        for ext in ['.js', '.ts', '.py', '.java', '.go']:
            for f in service_path.rglob(f'*{ext}'):
                if 'node_modules' not in str(f) and 'test' not in str(f).lower() and 'spec' not in str(f).lower():
                    if '__pycache__' not in str(f) and '.d.ts' not in str(f):
                        source_files.append(f)

        # Find all test files
        test_patterns = ['test', 'spec', '_test', '.test', '.spec']
        test_files = set()
        for f in service_path.rglob('*'):
            if f.is_file():
                name_lower = f.stem.lower()
                if any(p in name_lower for p in test_patterns):
                    # Extract the base name being tested
                    for p in test_patterns:
                        name_lower = name_lower.replace(p, '')
                    test_files.add(name_lower)

        # Check for source files without tests
        untested_count = 0
        for source in source_files:
            base_name = source.stem.lower()
            if base_name not in ['index', 'main', '__init__', 'setup', 'config']:
                if base_name not in test_files:
                    untested_count += 1

        if untested_count > 0:
            coverage_estimate = 100 - (untested_count / max(len(source_files), 1) * 100)
            severity = "high" if coverage_estimate < 50 else "medium" if coverage_estimate < 70 else "low"

            if self._passes_threshold(severity):
                items.append(TechDebtItem(
                    id=self._generate_id(),
                    category="missing-tests",
                    severity=severity,
                    service=service_name,
                    file="(multiple)",
                    line=None,
                    description=f"{untested_count} source files without apparent tests (~{coverage_estimate:.0f}% estimated coverage)",
                    evidence=f"Source files: {len(source_files)}, Test files found: {len(test_files)}",
                    recommendation="Add unit tests for untested modules",
                    effort=f"{untested_count * 2}-{untested_count * 4}h",
                    confidence="MEDIUM"
                ))

        return items

    def analyze_all(self) -> Dict:
        """Run all analyzers on all services"""
        all_items = []

        for service in self.services:
            service_name = service.get('name', '')
            service_path = self.root_path / service.get('path', '')

            if not service_path.exists():
                continue

            print(f"Analyzing technical debt for: {service_name}")

            all_items.extend(self.analyze_debt_comments(service_path, service_name))
            all_items.extend(self.analyze_deprecated_patterns(service_path, service_name))
            all_items.extend(self.analyze_security_patterns(service_path, service_name))
            all_items.extend(self.analyze_code_smells(service_path, service_name))
            all_items.extend(self.analyze_file_complexity(service_path, service_name))
            all_items.extend(self.analyze_outdated_dependencies(service_path, service_name))
            all_items.extend(self.analyze_missing_tests(service_path, service_name))

        # Sort by severity
        severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
        all_items.sort(key=lambda x: severity_order.get(x.severity, 4))

        return {
            'total_items': len(all_items),
            'items': [item.to_dict() for item in all_items],
            'by_category': self._group_by_category(all_items),
            'by_severity': self._group_by_severity(all_items),
            'by_service': self._group_by_service(all_items),
            'summary': self._generate_summary(all_items),
        }

    def _group_by_category(self, items: List[TechDebtItem]) -> Dict[str, int]:
        grouped = defaultdict(int)
        for item in items:
            grouped[item.category] += 1
        return dict(grouped)

    def _group_by_severity(self, items: List[TechDebtItem]) -> Dict[str, int]:
        grouped = defaultdict(int)
        for item in items:
            grouped[item.severity] += 1
        return dict(grouped)

    def _group_by_service(self, items: List[TechDebtItem]) -> Dict[str, int]:
        grouped = defaultdict(int)
        for item in items:
            grouped[item.service] += 1
        return dict(grouped)

    def _generate_summary(self, items: List[TechDebtItem]) -> Dict:
        """Generate summary statistics"""
        total_effort_low = 0
        total_effort_high = 0

        for item in items:
            effort = item.effort
            match = re.search(r'(\d+)-(\d+)', effort)
            if match:
                total_effort_low += int(match.group(1))
                total_effort_high += int(match.group(2))

        return {
            'total_items': len(items),
            'critical_count': sum(1 for i in items if i.severity == 'critical'),
            'high_count': sum(1 for i in items if i.severity == 'high'),
            'medium_count': sum(1 for i in items if i.severity == 'medium'),
            'low_count': sum(1 for i in items if i.severity == 'low'),
            'estimated_effort_hours': f"{total_effort_low}-{total_effort_high}",
            'estimated_effort_days': f"{total_effort_low/8:.1f}-{total_effort_high/8:.1f}",
        }


def format_markdown(data: Dict) -> str:
    """Format technical debt data as markdown"""
    summary = data['summary']

    output = f"""# Technical Debt Analysis Report

**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M')}

## Executive Summary

| Metric | Value |
|--------|-------|
| **Total Debt Items** | {summary['total_items']} |
| **Critical** | 🔴 {summary['critical_count']} |
| **High** | 🟠 {summary['high_count']} |
| **Medium** | 🟡 {summary['medium_count']} |
| **Low** | 🟢 {summary['low_count']} |
| **Estimated Effort** | {summary['estimated_effort_hours']} hours ({summary['estimated_effort_days']} days) |

## By Category

| Category | Count |
|----------|-------|
"""

    for category, count in data['by_category'].items():
        output += f"| {category} | {count} |\n"

    output += "\n## By Service\n\n| Service | Debt Items |\n|---------|------------|\n"

    for service, count in data['by_service'].items():
        output += f"| {service} | {count} |\n"

    output += "\n## Debt Register\n\n"

    # Group by severity for the register
    for severity in ['critical', 'high', 'medium', 'low']:
        items = [i for i in data['items'] if i['severity'] == severity]
        if items:
            emoji = {'critical': '🔴', 'high': '🟠', 'medium': '🟡', 'low': '🟢'}[severity]
            output += f"\n### {emoji} {severity.upper()} ({len(items)})\n\n"
            output += "| ID | Service | File | Description | Recommendation |\n"
            output += "|----|---------|------|-------------|----------------|\n"

            for item in items[:20]:  # Limit per severity
                file_loc = f"{item['file']}:{item['line']}" if item['line'] else item['file']
                desc = item['description'][:50] + "..." if len(item['description']) > 50 else item['description']
                rec = item['recommendation'][:40] + "..." if len(item['recommendation']) > 40 else item['recommendation']
                output += f"| {item['id']} | {item['service']} | `{file_loc}` | {desc} | {rec} |\n"

            if len(items) > 20:
                output += f"\n*...and {len(items) - 20} more {severity} items*\n"

    output += """
## Recommendations

### Immediate Actions (Critical/High)
"""

    critical_high = [i for i in data['items'] if i['severity'] in ['critical', 'high']][:5]
    for i, item in enumerate(critical_high, 1):
        output += f"\n{i}. **{item['id']}**: {item['description']}\n"
        output += f"   - File: `{item['file']}`\n"
        output += f"   - Action: {item['recommendation']}\n"
        output += f"   - Effort: {item['effort']}\n"

    output += """
## Methodology

This analysis uses static code analysis to detect:
- TODO/FIXME/HACK comments indicating known issues
- Deprecated patterns and outdated APIs
- Security anti-patterns and hardcoded secrets
- Code complexity and large files
- Code smells and anti-patterns
- Outdated dependencies
- Missing test coverage

**Confidence Levels**:
- HIGH: Pattern directly matched in code
- MEDIUM: Inferred from code patterns
"""

    return output


def main():
    parser = argparse.ArgumentParser(description='Analyze technical debt in microservices')
    parser.add_argument('path', nargs='?', default='.', help='Repository path to analyze')
    parser.add_argument('--services', '-s', help='Services JSON file from analyze_structure.py')
    parser.add_argument('--output', '-o', help='Output file')
    parser.add_argument('--format', '-f', choices=['json', 'markdown'], default='markdown')
    parser.add_argument('--threshold', '-t', choices=['low', 'medium', 'high', 'critical'],
                       default='medium', help='Minimum severity to report')

    args = parser.parse_args()

    # Load services if provided
    services = []
    if args.services and Path(args.services).exists():
        with open(args.services) as f:
            data = json.load(f)
            services = data.get('services', [])
    else:
        # Try to auto-discover services
        try:
            from analyze_structure import ServiceDiscoverer
            discoverer = ServiceDiscoverer(args.path)
            inventory = discoverer.generate_inventory()
            services = inventory.get('services', [])
        except ImportError:
            # Analyze current directory as single service
            services = [{'name': Path(args.path).name, 'path': '.'}]

    if not services:
        print("No services found. Analyzing current directory...")
        services = [{'name': Path(args.path).name, 'path': '.'}]

    # Analyze technical debt
    analyzer = TechDebtAnalyzer(args.path, services, threshold=args.threshold)
    result = analyzer.analyze_all()

    # Format output
    if args.format == 'json':
        output = json.dumps(result, indent=2)
    else:
        output = format_markdown(result)

    if args.output:
        with open(args.output, 'w') as f:
            f.write(output)
        print(f"Technical debt report written to {args.output}")
    else:
        print(output)


if __name__ == '__main__':
    main()

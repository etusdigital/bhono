#!/usr/bin/env python3
"""
Service Dependency Mapper
Maps dependencies between microservices using static code analysis.

Detects:
- HTTP client calls to other services
- Environment variables referencing service URLs
- Message queue publishers/consumers
- Service discovery patterns
- Database connections
- Internal package imports (monorepo)

Based on best practices from:
- Static codebase analysis for explicit dependencies
- Pattern matching for service URLs and API calls
- Environment variable analysis for service discovery
"""

import os
import re
import json
import argparse
from pathlib import Path
from typing import Dict, List, Set, Tuple, Optional
from dataclasses import dataclass, field, asdict
from collections import defaultdict


@dataclass
class Dependency:
    """Represents a dependency between services"""
    source: str
    target: str
    dep_type: str  # http, grpc, queue, database, internal
    evidence: List[str] = field(default_factory=list)
    confidence: str = "MEDIUM"

    def to_dict(self):
        return asdict(self)


class DependencyMapper:
    """Maps dependencies between microservices through static analysis"""

    # HTTP client patterns by language
    HTTP_PATTERNS = {
        'javascript': [
            # axios calls
            r"axios\.(get|post|put|delete|patch)\s*\(\s*['\"`]([^'\"]+)['\"`]",
            r"axios\.(get|post|put|delete|patch)\s*\(\s*`([^`]+)`",
            r"axios\s*\(\s*\{[^}]*url:\s*['\"`]([^'\"]+)['\"`]",
            # fetch calls
            r"fetch\s*\(\s*['\"`]([^'\"]+)['\"`]",
            r"fetch\s*\(\s*`([^`]+)`",
            # got, node-fetch, superagent
            r"got\s*\(\s*['\"`]([^'\"]+)['\"`]",
            r"request\s*\(\s*['\"`]([^'\"]+)['\"`]",
        ],
        'python': [
            # requests library
            r"requests\.(get|post|put|delete|patch)\s*\(\s*['\"]([^'\"]+)['\"]",
            r"requests\.(get|post|put|delete|patch)\s*\(\s*f['\"]([^'\"]+)['\"]",
            # httpx
            r"httpx\.(get|post|put|delete|patch)\s*\(\s*['\"]([^'\"]+)['\"]",
            r"client\.(get|post|put|delete|patch)\s*\(\s*['\"]([^'\"]+)['\"]",
            # aiohttp
            r"session\.(get|post|put|delete|patch)\s*\(\s*['\"]([^'\"]+)['\"]",
        ],
        'java': [
            # RestTemplate
            r"restTemplate\.(getForObject|postForObject|exchange)\s*\(\s*\"([^\"]+)\"",
            # WebClient
            r"\.uri\s*\(\s*\"([^\"]+)\"",
            # Feign clients
            r"@FeignClient\s*\([^)]*url\s*=\s*\"([^\"]+)\"",
            r"@FeignClient\s*\([^)]*name\s*=\s*\"([^\"]+)\"",
        ],
        'go': [
            # net/http
            r"http\.(Get|Post|Put|Delete)\s*\(\s*\"([^\"]+)\"",
            r"http\.NewRequest\s*\([^,]+,\s*\"([^\"]+)\"",
            # resty, req
            r"\.(Get|Post|Put|Delete)\s*\(\s*\"([^\"]+)\"",
        ],
    }

    # Environment variable patterns for service URLs
    ENV_PATTERNS = [
        r"(\w+_SERVICE_URL)",
        r"(\w+_API_URL)",
        r"(\w+_ENDPOINT)",
        r"(\w+_HOST)",
        r"(\w+_BASE_URL)",
    ]

    # Message queue patterns
    QUEUE_PATTERNS = {
        'kafka': [
            r"\.send\s*\(\s*['\"]([^'\"]+)['\"]",  # producer
            r"\.subscribe\s*\(\s*\[?['\"]([^'\"]+)['\"]",  # consumer
            r"@KafkaListener\s*\([^)]*topics?\s*=\s*['\"]([^'\"]+)['\"]",
        ],
        'rabbitmq': [
            r"channel\.publish\s*\([^,]*,\s*['\"]([^'\"]+)['\"]",
            r"channel\.consume\s*\(\s*['\"]([^'\"]+)['\"]",
            r"channel\.queue_declare\s*\(\s*queue\s*=\s*['\"]([^'\"]+)['\"]",
            r"@RabbitListener\s*\([^)]*queues?\s*=\s*['\"]([^'\"]+)['\"]",
        ],
        'redis': [
            r"\.publish\s*\(\s*['\"]([^'\"]+)['\"]",
            r"\.subscribe\s*\(\s*['\"]([^'\"]+)['\"]",
            r"pubsub\.subscribe\s*\(\s*['\"]([^'\"]+)['\"]",
        ],
        'sqs': [
            r"\.send_message\s*\([^)]*QueueUrl\s*=\s*['\"]([^'\"]+)['\"]",
            r"\.receive_message\s*\([^)]*QueueUrl\s*=\s*['\"]([^'\"]+)['\"]",
        ],
        'nats': [
            r"\.Publish\s*\(\s*['\"]([^'\"]+)['\"]",
            r"\.Subscribe\s*\(\s*['\"]([^'\"]+)['\"]",
        ],
    }

    # Database connection patterns
    DB_PATTERNS = {
        'postgresql': [
            r"postgresql://([^/]+)/(\w+)",
            r"postgres://([^/]+)/(\w+)",
            r"PG_DATABASE\s*=\s*['\"]?(\w+)",
        ],
        'mongodb': [
            r"mongodb://([^/]+)/(\w+)",
            r"mongodb\+srv://([^/]+)/(\w+)",
            r"MONGO_DATABASE\s*=\s*['\"]?(\w+)",
        ],
        'mysql': [
            r"mysql://([^/]+)/(\w+)",
            r"MYSQL_DATABASE\s*=\s*['\"]?(\w+)",
        ],
        'redis': [
            r"redis://([^/]+)",
            r"REDIS_HOST\s*=\s*['\"]?([^'\"\s]+)",
        ],
    }

    # gRPC patterns
    GRPC_PATTERNS = [
        r"\.NewClient\s*\(\s*['\"]([^'\"]+)['\"]",
        r"grpc\.Dial\s*\(\s*['\"]([^'\"]+)['\"]",
        r"@GrpcClient\s*\(['\"]([^'\"]+)['\"]",
        r"ManagedChannelBuilder\.forAddress\s*\(\s*\"([^\"]+)\"",
    ]

    def __init__(self, root_path: str, services: List[Dict] = None):
        self.root_path = Path(root_path).resolve()
        self.services = services or []
        self.service_names = {s.get('name', '').lower() for s in self.services}
        self.dependencies: List[Dependency] = []
        self.env_vars: Dict[str, Set[str]] = defaultdict(set)

    def detect_language(self, file_path: Path) -> Optional[str]:
        """Detect language from file extension"""
        ext_map = {
            '.js': 'javascript', '.ts': 'javascript', '.jsx': 'javascript', '.tsx': 'javascript',
            '.py': 'python',
            '.java': 'java', '.kt': 'java',
            '.go': 'go',
        }
        return ext_map.get(file_path.suffix.lower())

    def extract_service_name_from_url(self, url: str) -> Optional[str]:
        """Extract service name from URL pattern"""
        # Common patterns: http://service-name:port, ${SERVICE_NAME}_URL, service-name.namespace
        patterns = [
            r"https?://([a-z0-9-]+)(?::\d+)?",  # http://service-name:8080
            r"\$\{?([A-Z_]+)_(?:URL|HOST|ENDPOINT)",  # ${SERVICE_NAME}_URL
            r"([a-z0-9-]+)\.(?:svc|service|internal)",  # service.svc.cluster.local
        ]

        for pattern in patterns:
            match = re.search(pattern, url, re.IGNORECASE)
            if match:
                name = match.group(1).lower().replace('_', '-')
                # Check if it looks like a service name
                if name not in ['localhost', 'http', 'https', 'api', 'www']:
                    return name
        return None

    def analyze_http_dependencies(self, service_path: Path, service_name: str) -> List[Dependency]:
        """Find HTTP calls to other services"""
        deps = []

        for file_path in service_path.rglob('*'):
            if file_path.is_file() and 'node_modules' not in str(file_path):
                language = self.detect_language(file_path)
                if not language:
                    continue

                try:
                    content = file_path.read_text(errors='ignore')
                    patterns = self.HTTP_PATTERNS.get(language, [])

                    for pattern in patterns:
                        matches = re.finditer(pattern, content, re.MULTILINE)
                        for match in matches:
                            # Extract URL (might be in different groups)
                            url = match.group(2) if len(match.groups()) > 1 else match.group(1)
                            target = self.extract_service_name_from_url(url)

                            if target and target != service_name:
                                rel_path = file_path.relative_to(service_path)
                                evidence = f"{rel_path}: {match.group(0)[:100]}"

                                # Determine confidence
                                confidence = "HIGH" if target in self.service_names else "MEDIUM"

                                deps.append(Dependency(
                                    source=service_name,
                                    target=target,
                                    dep_type="http",
                                    evidence=[evidence],
                                    confidence=confidence
                                ))
                except Exception:
                    continue

        return deps

    def analyze_env_dependencies(self, service_path: Path, service_name: str) -> List[Dependency]:
        """Find dependencies from environment variables"""
        deps = []
        env_files = ['.env', '.env.example', '.env.local', 'docker-compose.yml',
                     'docker-compose.yaml', 'deployment.yaml']

        for env_file in env_files:
            file_path = service_path / env_file
            if file_path.exists():
                try:
                    content = file_path.read_text()

                    for pattern in self.ENV_PATTERNS:
                        matches = re.finditer(pattern, content)
                        for match in matches:
                            env_var = match.group(1)
                            # Extract service name from env var
                            service_part = env_var.replace('_SERVICE_URL', '').replace('_API_URL', '')
                            service_part = service_part.replace('_ENDPOINT', '').replace('_HOST', '')
                            service_part = service_part.replace('_BASE_URL', '').lower().replace('_', '-')

                            if service_part and service_part != service_name:
                                self.env_vars[service_name].add(env_var)
                                confidence = "HIGH" if service_part in self.service_names else "MEDIUM"

                                deps.append(Dependency(
                                    source=service_name,
                                    target=service_part,
                                    dep_type="http",
                                    evidence=[f"{env_file}: {env_var}"],
                                    confidence=confidence
                                ))
                except Exception:
                    continue

        return deps

    def analyze_queue_dependencies(self, service_path: Path, service_name: str) -> List[Dependency]:
        """Find message queue publish/subscribe patterns"""
        deps = []
        topics_published: Set[str] = set()
        topics_consumed: Set[str] = set()

        for file_path in service_path.rglob('*'):
            if file_path.is_file() and 'node_modules' not in str(file_path):
                try:
                    content = file_path.read_text(errors='ignore')

                    for queue_type, patterns in self.QUEUE_PATTERNS.items():
                        for pattern in patterns:
                            matches = re.finditer(pattern, content, re.MULTILINE | re.IGNORECASE)
                            for match in matches:
                                topic = match.group(1)
                                rel_path = file_path.relative_to(service_path)

                                # Determine if publish or subscribe
                                if 'publish' in pattern.lower() or 'send' in pattern.lower():
                                    topics_published.add(topic)
                                    deps.append(Dependency(
                                        source=service_name,
                                        target=f"queue:{topic}",
                                        dep_type=f"queue-publish-{queue_type}",
                                        evidence=[f"{rel_path}: publishes to {topic}"],
                                        confidence="HIGH"
                                    ))
                                else:
                                    topics_consumed.add(topic)
                                    deps.append(Dependency(
                                        source=f"queue:{topic}",
                                        target=service_name,
                                        dep_type=f"queue-consume-{queue_type}",
                                        evidence=[f"{rel_path}: consumes from {topic}"],
                                        confidence="HIGH"
                                    ))
                except Exception:
                    continue

        return deps

    def analyze_database_dependencies(self, service_path: Path, service_name: str) -> List[Dependency]:
        """Find database connections"""
        deps = []

        search_files = list(service_path.rglob('*.env*')) + \
                      list(service_path.rglob('*config*')) + \
                      list(service_path.rglob('docker-compose*'))

        for file_path in search_files:
            if file_path.is_file():
                try:
                    content = file_path.read_text(errors='ignore')

                    for db_type, patterns in self.DB_PATTERNS.items():
                        for pattern in patterns:
                            matches = re.finditer(pattern, content, re.IGNORECASE)
                            for match in matches:
                                db_name = match.group(2) if len(match.groups()) > 1 else match.group(1)
                                rel_path = file_path.relative_to(service_path)

                                deps.append(Dependency(
                                    source=service_name,
                                    target=f"db:{db_type}:{db_name}",
                                    dep_type="database",
                                    evidence=[f"{rel_path}: {db_type} connection"],
                                    confidence="HIGH"
                                ))
                except Exception:
                    continue

        return deps

    def analyze_grpc_dependencies(self, service_path: Path, service_name: str) -> List[Dependency]:
        """Find gRPC client connections"""
        deps = []

        for file_path in service_path.rglob('*'):
            if file_path.is_file() and 'node_modules' not in str(file_path):
                try:
                    content = file_path.read_text(errors='ignore')

                    for pattern in self.GRPC_PATTERNS:
                        matches = re.finditer(pattern, content, re.MULTILINE)
                        for match in matches:
                            target = match.group(1)
                            target_service = self.extract_service_name_from_url(target)

                            if target_service and target_service != service_name:
                                rel_path = file_path.relative_to(service_path)
                                confidence = "HIGH" if target_service in self.service_names else "MEDIUM"

                                deps.append(Dependency(
                                    source=service_name,
                                    target=target_service,
                                    dep_type="grpc",
                                    evidence=[f"{rel_path}: gRPC client to {target}"],
                                    confidence=confidence
                                ))
                except Exception:
                    continue

        return deps

    def analyze_internal_imports(self, service_path: Path, service_name: str) -> List[Dependency]:
        """Find internal package imports (monorepo)"""
        deps = []

        # Check package.json for workspace dependencies
        pkg_file = service_path / 'package.json'
        if pkg_file.exists():
            try:
                with open(pkg_file) as f:
                    data = json.load(f)
                    all_deps = {**data.get('dependencies', {}), **data.get('devDependencies', {})}

                    for dep_name in all_deps:
                        # Check if it's an internal package (starts with @ or matches service name pattern)
                        if dep_name.startswith('@') or dep_name in self.service_names:
                            clean_name = dep_name.lstrip('@').split('/')[0]
                            if clean_name != service_name:
                                deps.append(Dependency(
                                    source=service_name,
                                    target=clean_name,
                                    dep_type="internal",
                                    evidence=[f"package.json: {dep_name}"],
                                    confidence="HIGH"
                                ))
            except Exception:
                pass

        return deps

    def map_all_dependencies(self) -> Dict:
        """Map all dependencies for all services"""
        all_deps = []

        for service in self.services:
            service_name = service.get('name', '')
            service_path = self.root_path / service.get('path', '')

            if not service_path.exists():
                continue

            print(f"Analyzing dependencies for: {service_name}")

            # Run all analyzers
            all_deps.extend(self.analyze_http_dependencies(service_path, service_name))
            all_deps.extend(self.analyze_env_dependencies(service_path, service_name))
            all_deps.extend(self.analyze_queue_dependencies(service_path, service_name))
            all_deps.extend(self.analyze_database_dependencies(service_path, service_name))
            all_deps.extend(self.analyze_grpc_dependencies(service_path, service_name))
            all_deps.extend(self.analyze_internal_imports(service_path, service_name))

        # Deduplicate and merge evidence
        merged = self._merge_dependencies(all_deps)

        return {
            'total_dependencies': len(merged),
            'dependencies': [d.to_dict() for d in merged],
            'by_type': self._group_by_type(merged),
            'dependency_matrix': self._build_matrix(merged),
            'confidence_summary': self._confidence_summary(merged),
        }

    def _merge_dependencies(self, deps: List[Dependency]) -> List[Dependency]:
        """Merge duplicate dependencies and combine evidence"""
        merged: Dict[Tuple, Dependency] = {}

        for dep in deps:
            key = (dep.source, dep.target, dep.dep_type)
            if key in merged:
                merged[key].evidence.extend(dep.evidence)
                # Upgrade confidence if we have more evidence
                if dep.confidence == "HIGH":
                    merged[key].confidence = "HIGH"
            else:
                merged[key] = dep

        return list(merged.values())

    def _group_by_type(self, deps: List[Dependency]) -> Dict[str, int]:
        """Group dependencies by type"""
        by_type = defaultdict(int)
        for dep in deps:
            by_type[dep.dep_type] += 1
        return dict(by_type)

    def _build_matrix(self, deps: List[Dependency]) -> Dict[str, Dict[str, List[str]]]:
        """Build dependency matrix"""
        matrix = defaultdict(lambda: defaultdict(list))
        for dep in deps:
            matrix[dep.source][dep.target].append(dep.dep_type)
        return {k: dict(v) for k, v in matrix.items()}

    def _confidence_summary(self, deps: List[Dependency]) -> Dict[str, int]:
        """Summarize confidence levels"""
        summary = defaultdict(int)
        for dep in deps:
            summary[dep.confidence] += 1
        return dict(summary)


def format_markdown(data: Dict) -> str:
    """Format dependency data as markdown"""
    output = f"""# Service Dependency Map

## Summary
- **Total Dependencies**: {data['total_dependencies']}
- **Confidence**: HIGH: {data['confidence_summary'].get('HIGH', 0)}, MEDIUM: {data['confidence_summary'].get('MEDIUM', 0)}, LOW: {data['confidence_summary'].get('LOW', 0)}

## Dependencies by Type
"""

    for dep_type, count in data['by_type'].items():
        output += f"- **{dep_type}**: {count}\n"

    output += "\n## Dependency Matrix\n\n"
    output += "| Source | Target | Type | Confidence |\n"
    output += "|--------|--------|------|------------|\n"

    for dep in data['dependencies']:
        output += f"| {dep['source']} | {dep['target']} | {dep['dep_type']} | {dep['confidence']} |\n"

    # Generate Mermaid diagram
    output += "\n## Dependency Graph\n\n```mermaid\ngraph LR\n"

    for dep in data['dependencies'][:30]:  # Limit for readability
        source = dep['source'].replace('-', '_').replace(':', '_')
        target = dep['target'].replace('-', '_').replace(':', '_')
        line_style = "==>" if dep['confidence'] == "HIGH" else "-->"
        output += f"    {source} {line_style}|{dep['dep_type']}| {target}\n"

    output += "```\n"

    return output


def main():
    parser = argparse.ArgumentParser(description='Map dependencies between microservices')
    parser.add_argument('path', nargs='?', default='.', help='Repository path to analyze')
    parser.add_argument('--services', '-s', help='Services JSON file from analyze_structure.py')
    parser.add_argument('--output', '-o', help='Output file')
    parser.add_argument('--format', '-f', choices=['json', 'markdown', 'matrix'],
                       default='markdown', help='Output format')

    args = parser.parse_args()

    # Load services if provided
    services = []
    if args.services and Path(args.services).exists():
        with open(args.services) as f:
            data = json.load(f)
            services = data.get('services', [])
    else:
        # Try to auto-discover services
        from analyze_structure import ServiceDiscoverer
        discoverer = ServiceDiscoverer(args.path)
        inventory = discoverer.generate_inventory()
        services = inventory.get('services', [])

    if not services:
        print("No services found. Run analyze_structure.py first or provide --services file")
        return

    # Map dependencies
    mapper = DependencyMapper(args.path, services)
    result = mapper.map_all_dependencies()

    # Format output
    if args.format == 'json':
        output = json.dumps(result, indent=2)
    elif args.format == 'matrix':
        # Print as matrix only
        output = json.dumps(result['dependency_matrix'], indent=2)
    else:
        output = format_markdown(result)

    if args.output:
        with open(args.output, 'w') as f:
            f.write(output)
        print(f"Dependency map written to {args.output}")
    else:
        print(output)


if __name__ == '__main__':
    main()

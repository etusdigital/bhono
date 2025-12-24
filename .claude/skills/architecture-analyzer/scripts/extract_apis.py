#!/usr/bin/env python3
"""
API Extractor
Extracts API endpoints from microservices code
"""

import os
import re
import json
import argparse
from pathlib import Path
from typing import Dict, List, Optional, Set

class APIExtractor:
    """Extract API endpoints from various frameworks"""
    
    # Regex patterns for different frameworks
    PATTERNS = {
        'express': [
            r"app\.(get|post|put|delete|patch|options|head)\s*\(\s*['\"`]([^'\"]+)['\"`]",
            r"router\.(get|post|put|delete|patch|options|head)\s*\(\s*['\"`]([^'\"]+)['\"`]",
        ],
        'fastapi': [
            r"@app\.(get|post|put|delete|patch|options|head)\s*\(\s*['\"`]([^'\"]+)['\"`]",
            r"@router\.(get|post|put|delete|patch|options|head)\s*\(\s*['\"`]([^'\"]+)['\"`]",
        ],
        'flask': [
            r"@app\.route\s*\(\s*['\"`]([^'\"]+)['\"`].*methods=\[(.*?)\]",
            r"@app\.route\s*\(\s*['\"`]([^'\"]+)['\"`]",
        ],
        'spring': [
            r"@(Get|Post|Put|Delete|Patch|Request)Mapping\s*\(\s*.*?['\"`]([^'\"]+)['\"`]",
            r"@(Get|Post|Put|Delete|Patch|Request)Mapping\s*\(\s*value\s*=\s*['\"`]([^'\"]+)['\"`]",
        ],
        'gin': [
            r"router\.(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s*\(\s*['\"`]([^'\"]+)['\"`]",
            r"r\.(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s*\(\s*['\"`]([^'\"]+)['\"`]",
        ],
        'django': [
            r"path\s*\(\s*['\"`]([^'\"]+)['\"`]",
            r"url\s*\(\s*r?['\"`]\^?([^'\"]+)\$?['\"`]",
        ],
    }
    
    # GraphQL patterns
    GRAPHQL_PATTERNS = [
        r"type\s+Query\s*{([^}]+)}",
        r"type\s+Mutation\s*{([^}]+)}",
        r"type\s+Subscription\s*{([^}]+)}",
    ]
    
    # gRPC patterns
    GRPC_PATTERNS = [
        r"service\s+(\w+)\s*{([^}]+)}",
        r"rpc\s+(\w+)\s*\(([^)]+)\)\s*returns\s*\(([^)]+)\)",
    ]
    
    def __init__(self, service_path: str):
        self.service_path = Path(service_path)
        self.apis = []
    
    def detect_framework(self) -> Optional[str]:
        """Detect the framework used by the service"""
        # Check package.json for Node.js frameworks
        pkg_file = self.service_path / 'package.json'
        if pkg_file.exists():
            try:
                with open(pkg_file) as f:
                    data = json.load(f)
                    deps = {**data.get('dependencies', {}), 
                            **data.get('devDependencies', {})}
                    
                    if 'express' in deps:
                        return 'express'
                    if 'fastify' in deps:
                        return 'express'  # Similar patterns
                    if '@nestjs/core' in deps:
                        return 'express'  # Similar patterns
                    if 'koa' in deps:
                        return 'express'  # Similar patterns
            except:
                pass
        
        # Check for Python frameworks
        for file in self.service_path.glob('**/*.py'):
            try:
                content = file.read_text()
                if 'from flask' in content or 'import flask' in content:
                    return 'flask'
                if 'from fastapi' in content or 'import fastapi' in content:
                    return 'fastapi'
                if 'from django' in content or 'import django' in content:
                    return 'django'
            except:
                continue
        
        # Check for Java/Spring
        for file in self.service_path.glob('**/*.java'):
            try:
                content = file.read_text()
                if '@RestController' in content or '@RequestMapping' in content:
                    return 'spring'
            except:
                continue
        
        # Check for Go/Gin
        for file in self.service_path.glob('**/*.go'):
            try:
                content = file.read_text()
                if 'github.com/gin-gonic/gin' in content:
                    return 'gin'
            except:
                continue
        
        return None
    
    def extract_rest_endpoints(self, file_path: Path, framework: str) -> List[Dict]:
        """Extract REST endpoints from a file"""
        endpoints = []
        
        try:
            content = file_path.read_text()
            patterns = self.PATTERNS.get(framework, [])
            
            for pattern in patterns:
                matches = re.finditer(pattern, content, re.MULTILINE | re.IGNORECASE)
                for match in matches:
                    if framework in ['express', 'fastapi', 'gin']:
                        method = match.group(1).upper()
                        path = match.group(2)
                    elif framework == 'spring':
                        method = match.group(1).replace('Mapping', '').upper()
                        if method == 'REQUEST':
                            method = 'GET'  # Default
                        path = match.group(2) if len(match.groups()) > 1 else '/'
                    elif framework == 'flask':
                        if len(match.groups()) > 1:
                            path = match.group(1)
                            methods = match.group(2) if match.group(2) else 'GET'
                            method = methods.split(',')[0].strip().strip("'\"").upper()
                        else:
                            path = match.group(1)
                            method = 'GET'
                    elif framework == 'django':
                        path = match.group(1)
                        method = 'GET'  # Django doesn't specify in URL
                    else:
                        continue
                    
                    endpoints.append({
                        'method': method,
                        'path': path,
                        'file': str(file_path.relative_to(self.service_path)),
                        'type': 'REST',
                        'confidence': 'HIGH'
                    })
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
        
        return endpoints
    
    def extract_graphql_endpoints(self) -> List[Dict]:
        """Extract GraphQL operations"""
        endpoints = []
        
        for file in self.service_path.glob('**/*.graphql'):
            try:
                content = file.read_text()
                
                for pattern in self.GRAPHQL_PATTERNS:
                    matches = re.finditer(pattern, content, re.MULTILINE | re.DOTALL)
                    for match in matches:
                        operation_type = pattern.split()[1].lower()
                        operations = match.group(1)
                        
                        # Extract individual operations
                        op_pattern = r'(\w+)\s*(?:\([^)]*\))?\s*:'
                        op_matches = re.finditer(op_pattern, operations)
                        
                        for op_match in op_matches:
                            endpoints.append({
                                'operation': op_match.group(1),
                                'type': 'GraphQL',
                                'operation_type': operation_type,
                                'file': str(file.relative_to(self.service_path)),
                                'confidence': 'HIGH'
                            })
            except:
                continue
        
        return endpoints
    
    def extract_grpc_endpoints(self) -> List[Dict]:
        """Extract gRPC service definitions"""
        endpoints = []
        
        for file in self.service_path.glob('**/*.proto'):
            try:
                content = file.read_text()
                
                # Find services
                service_pattern = r"service\s+(\w+)\s*{([^}]+)}"
                service_matches = re.finditer(service_pattern, content, re.MULTILINE | re.DOTALL)
                
                for service_match in service_matches:
                    service_name = service_match.group(1)
                    service_content = service_match.group(2)
                    
                    # Find RPCs in service
                    rpc_pattern = r"rpc\s+(\w+)\s*\(([^)]+)\)\s*returns\s*\(([^)]+)\)"
                    rpc_matches = re.finditer(rpc_pattern, service_content)
                    
                    for rpc_match in rpc_matches:
                        endpoints.append({
                            'service': service_name,
                            'method': rpc_match.group(1),
                            'request': rpc_match.group(2).strip(),
                            'response': rpc_match.group(3).strip(),
                            'type': 'gRPC',
                            'file': str(file.relative_to(self.service_path)),
                            'confidence': 'HIGH'
                        })
            except:
                continue
        
        return endpoints
    
    def extract_all_apis(self) -> Dict:
        """Extract all APIs from the service"""
        framework = self.detect_framework()
        
        apis = {
            'service_path': str(self.service_path),
            'framework': framework or 'Unknown',
            'rest_endpoints': [],
            'graphql_operations': [],
            'grpc_services': [],
            'total_endpoints': 0
        }
        
        # Extract REST endpoints
        if framework:
            file_patterns = {
                'express': ['**/*.js', '**/*.ts'],
                'flask': ['**/*.py'],
                'fastapi': ['**/*.py'],
                'django': ['**/urls.py', '**/views.py'],
                'spring': ['**/*.java'],
                'gin': ['**/*.go'],
            }
            
            patterns = file_patterns.get(framework, ['**/*'])
            for pattern in patterns:
                for file in self.service_path.glob(pattern):
                    if 'node_modules' not in str(file) and 'test' not in str(file).lower():
                        apis['rest_endpoints'].extend(
                            self.extract_rest_endpoints(file, framework)
                        )
        
        # Extract GraphQL
        apis['graphql_operations'] = self.extract_graphql_endpoints()
        
        # Extract gRPC
        apis['grpc_services'] = self.extract_grpc_endpoints()
        
        # Total count
        apis['total_endpoints'] = (
            len(apis['rest_endpoints']) + 
            len(apis['graphql_operations']) + 
            len(apis['grpc_services'])
        )
        
        return apis

def format_markdown(apis: Dict) -> str:
    """Format APIs as markdown"""
    output = f"""# API Documentation

## Service: {apis['service_path']}
- **Framework**: {apis['framework']}
- **Total Endpoints**: {apis['total_endpoints']}

"""
    
    if apis['rest_endpoints']:
        output += "## REST Endpoints\n\n"
        output += "| Method | Path | File | Confidence |\n"
        output += "|--------|------|------|------------|\n"
        
        for endpoint in apis['rest_endpoints']:
            output += f"| {endpoint['method']} | `{endpoint['path']}` | {endpoint['file']} | {endpoint['confidence']} |\n"
        output += "\n"
    
    if apis['graphql_operations']:
        output += "## GraphQL Operations\n\n"
        output += "| Operation | Type | File | Confidence |\n"
        output += "|-----------|------|------|------------|\n"
        
        for op in apis['graphql_operations']:
            output += f"| {op['operation']} | {op['operation_type']} | {op['file']} | {op['confidence']} |\n"
        output += "\n"
    
    if apis['grpc_services']:
        output += "## gRPC Services\n\n"
        output += "| Service | Method | Request | Response | File |\n"
        output += "|---------|--------|---------|----------|------|\n"
        
        for rpc in apis['grpc_services']:
            output += f"| {rpc['service']} | {rpc['method']} | {rpc['request']} | {rpc['response']} | {rpc['file']} |\n"
        output += "\n"
    
    return output

def main():
    parser = argparse.ArgumentParser(description='Extract API endpoints from microservices')
    parser.add_argument('path', nargs='?', default='.', help='Service path to analyze')
    parser.add_argument('--output', '-o', help='Output file')
    parser.add_argument('--format', '-f', choices=['json', 'markdown'], default='markdown')
    
    args = parser.parse_args()
    
    extractor = APIExtractor(args.path)
    apis = extractor.extract_all_apis()
    
    if args.format == 'json':
        output = json.dumps(apis, indent=2)
    else:
        output = format_markdown(apis)
    
    if args.output:
        with open(args.output, 'w') as f:
            f.write(output)
        print(f"API documentation written to {args.output}")
    else:
        print(output)

if __name__ == '__main__':
    main()

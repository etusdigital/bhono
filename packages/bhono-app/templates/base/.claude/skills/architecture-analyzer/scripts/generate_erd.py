#!/usr/bin/env python3
"""
ERD (Entity Relationship Diagram) Generator
Generates ERD diagrams from ORM model definitions in source code.

Supports:
- Prisma (.prisma files)
- SQLAlchemy (Python models)
- TypeORM (TypeScript decorators)
- Django (models.py)
- Mongoose (JavaScript/TypeScript schemas)
- Sequelize (JavaScript/TypeScript models)
- JPA/Hibernate (Java entities)

Output formats:
- Mermaid ERD syntax (default)
- PlantUML
- DOT (Graphviz)
- JSON (raw data)

Based on approaches from:
- prisma-erd-generator: https://github.com/keonik/prisma-erd-generator
- paracelsus: https://github.com/tedivm/paracelsus
- mermerd: https://github.com/KarnerTh/mermerd
"""

import os
import re
import json
import argparse
from pathlib import Path
from typing import Dict, List, Set, Optional, Tuple
from dataclasses import dataclass, field, asdict
from collections import defaultdict
from enum import Enum


class RelationType(Enum):
    ONE_TO_ONE = "1--1"
    ONE_TO_MANY = "1--*"
    MANY_TO_ONE = "*--1"
    MANY_TO_MANY = "*--*"


class FieldType(Enum):
    STRING = "string"
    INT = "int"
    FLOAT = "float"
    BOOLEAN = "boolean"
    DATE = "date"
    DATETIME = "datetime"
    JSON = "json"
    UUID = "uuid"
    TEXT = "text"
    ENUM = "enum"
    BINARY = "binary"
    UNKNOWN = "unknown"


@dataclass
class Field:
    """Represents a database field/column"""
    name: str
    field_type: str
    is_primary_key: bool = False
    is_foreign_key: bool = False
    is_nullable: bool = True
    is_unique: bool = False
    default: Optional[str] = None
    references: Optional[str] = None  # Table.field for FK

    def to_dict(self):
        return asdict(self)


@dataclass
class Relationship:
    """Represents a relationship between entities"""
    source_entity: str
    target_entity: str
    relation_type: RelationType
    source_field: Optional[str] = None
    target_field: Optional[str] = None
    name: Optional[str] = None

    def to_dict(self):
        d = asdict(self)
        d['relation_type'] = self.relation_type.value
        return d


@dataclass
class Entity:
    """Represents a database entity/table"""
    name: str
    fields: List[Field] = field(default_factory=list)
    service: Optional[str] = None
    file_path: Optional[str] = None
    confidence: str = "HIGH"

    def to_dict(self):
        return {
            'name': self.name,
            'fields': [f.to_dict() for f in self.fields],
            'service': self.service,
            'file_path': self.file_path,
            'confidence': self.confidence
        }


class PrismaParser:
    """Parse Prisma schema files"""

    def parse(self, content: str, file_path: str = None) -> Tuple[List[Entity], List[Relationship]]:
        entities = []
        relationships = []

        # Match model blocks
        model_pattern = r'model\s+(\w+)\s*\{([^}]+)\}'
        matches = re.finditer(model_pattern, content, re.MULTILINE | re.DOTALL)

        for match in matches:
            model_name = match.group(1)
            model_body = match.group(2)
            fields = []

            # Parse fields
            field_pattern = r'(\w+)\s+(\w+)(\[\])?\s*(\?)?([^@\n]*)?(@[^\n]+)?'
            for field_match in re.finditer(field_pattern, model_body):
                field_name = field_match.group(1)
                field_type = field_match.group(2)
                is_array = field_match.group(3) is not None
                is_optional = field_match.group(4) is not None
                decorators = field_match.group(6) or ""

                # Skip relation fields for now, capture them separately
                if '@relation' in decorators:
                    # Extract relation info
                    rel_match = re.search(r'@relation\([^)]*references:\s*\[(\w+)\]', decorators)
                    if rel_match:
                        relationships.append(Relationship(
                            source_entity=model_name,
                            target_entity=field_type,
                            relation_type=RelationType.MANY_TO_ONE if not is_array else RelationType.ONE_TO_MANY,
                            source_field=field_name,
                            target_field=rel_match.group(1)
                        ))
                    continue

                # Check for special decorators
                is_pk = '@id' in decorators
                is_unique = '@unique' in decorators
                is_fk = 'Id' in field_name and field_type in ['Int', 'String', 'BigInt']

                # Map Prisma types
                type_map = {
                    'String': 'string', 'Int': 'int', 'BigInt': 'int',
                    'Float': 'float', 'Decimal': 'float', 'Boolean': 'boolean',
                    'DateTime': 'datetime', 'Date': 'date', 'Json': 'json',
                    'Bytes': 'binary', 'UUID': 'uuid'
                }

                fields.append(Field(
                    name=field_name,
                    field_type=type_map.get(field_type, field_type.lower()),
                    is_primary_key=is_pk,
                    is_foreign_key=is_fk,
                    is_nullable=is_optional,
                    is_unique=is_unique or is_pk,
                    references=f"{field_type}.id" if is_fk else None
                ))

            entities.append(Entity(
                name=model_name,
                fields=fields,
                file_path=file_path
            ))

        return entities, relationships


class SQLAlchemyParser:
    """Parse SQLAlchemy model files"""

    def parse(self, content: str, file_path: str = None) -> Tuple[List[Entity], List[Relationship]]:
        entities = []
        relationships = []

        # Find classes that inherit from Base or Model
        class_pattern = r'class\s+(\w+)\s*\([^)]*(?:Base|Model|db\.Model)[^)]*\)\s*:\s*((?:\n(?:[ \t]+[^\n]+))*)'
        matches = re.finditer(class_pattern, content, re.MULTILINE)

        for match in matches:
            class_name = match.group(1)
            class_body = match.group(2)
            fields = []

            # Parse Column definitions
            column_pattern = r'(\w+)\s*=\s*(?:db\.)?Column\s*\(\s*(?:db\.)?(\w+)(?:\([^)]*\))?\s*([^)]*)\)'
            for col_match in re.finditer(column_pattern, class_body):
                col_name = col_match.group(1)
                col_type = col_match.group(2)
                col_args = col_match.group(3)

                is_pk = 'primary_key=True' in col_args or 'primary_key = True' in col_args
                is_nullable = 'nullable=False' not in col_args
                is_unique = 'unique=True' in col_args

                # Check for ForeignKey
                fk_match = re.search(r"ForeignKey\s*\(\s*['\"]([^'\"]+)['\"]", col_args)
                is_fk = fk_match is not None
                references = fk_match.group(1) if fk_match else None

                # Map SQLAlchemy types
                type_map = {
                    'String': 'string', 'Text': 'text', 'Integer': 'int',
                    'BigInteger': 'int', 'SmallInteger': 'int', 'Float': 'float',
                    'Numeric': 'float', 'Boolean': 'boolean', 'DateTime': 'datetime',
                    'Date': 'date', 'Time': 'time', 'JSON': 'json', 'JSONB': 'json',
                    'UUID': 'uuid', 'LargeBinary': 'binary', 'Enum': 'enum'
                }

                fields.append(Field(
                    name=col_name,
                    field_type=type_map.get(col_type, col_type.lower()),
                    is_primary_key=is_pk,
                    is_foreign_key=is_fk,
                    is_nullable=is_nullable,
                    is_unique=is_unique,
                    references=references
                ))

                # Add relationship from FK
                if is_fk and references:
                    target_table = references.split('.')[0]
                    relationships.append(Relationship(
                        source_entity=class_name,
                        target_entity=target_table.title(),
                        relation_type=RelationType.MANY_TO_ONE,
                        source_field=col_name,
                        target_field=references.split('.')[-1] if '.' in references else 'id'
                    ))

            # Parse relationship() definitions
            rel_pattern = r'(\w+)\s*=\s*(?:db\.)?relationship\s*\(\s*["\'](\w+)["\']'
            for rel_match in re.finditer(rel_pattern, class_body):
                rel_name = rel_match.group(1)
                target = rel_match.group(2)

                # Determine cardinality from uselist
                is_one = 'uselist=False' in class_body[rel_match.start():rel_match.end()+100]
                rel_type = RelationType.ONE_TO_ONE if is_one else RelationType.ONE_TO_MANY

                relationships.append(Relationship(
                    source_entity=class_name,
                    target_entity=target,
                    relation_type=rel_type,
                    name=rel_name
                ))

            if fields:
                entities.append(Entity(
                    name=class_name,
                    fields=fields,
                    file_path=file_path
                ))

        return entities, relationships


class TypeORMParser:
    """Parse TypeORM entity files"""

    def parse(self, content: str, file_path: str = None) -> Tuple[List[Entity], List[Relationship]]:
        entities = []
        relationships = []

        # Find @Entity decorated classes
        entity_pattern = r'@Entity\s*\([^)]*\)\s*(?:export\s+)?class\s+(\w+)[^{]*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}'
        matches = re.finditer(entity_pattern, content, re.MULTILINE | re.DOTALL)

        for match in matches:
            class_name = match.group(1)
            class_body = match.group(2)
            fields = []

            # Parse @Column decorators
            column_pattern = r'@(?:PrimaryGeneratedColumn|PrimaryColumn|Column)\s*\(([^)]*)\)\s*(\w+)\s*[?!]?\s*:\s*(\w+)'
            for col_match in re.finditer(column_pattern, class_body):
                decorator_args = col_match.group(1)
                col_name = col_match.group(2)
                col_type = col_match.group(3)

                is_pk = 'PrimaryGeneratedColumn' in content[col_match.start()-30:col_match.start()] or \
                        'PrimaryColumn' in content[col_match.start()-20:col_match.start()]
                is_nullable = 'nullable: true' in decorator_args or 'nullable:true' in decorator_args
                is_unique = 'unique: true' in decorator_args

                # Map TypeScript types
                type_map = {
                    'string': 'string', 'number': 'int', 'boolean': 'boolean',
                    'Date': 'datetime', 'Buffer': 'binary', 'object': 'json'
                }

                fields.append(Field(
                    name=col_name,
                    field_type=type_map.get(col_type, col_type.lower()),
                    is_primary_key=is_pk,
                    is_nullable=is_nullable,
                    is_unique=is_unique
                ))

            # Parse relationship decorators
            rel_patterns = [
                (r'@OneToOne\s*\([^)]*\)\s*(\w+)\s*[?!]?\s*:\s*(\w+)', RelationType.ONE_TO_ONE),
                (r'@OneToMany\s*\([^)]*\)\s*(\w+)\s*[?!]?\s*:\s*(\w+)', RelationType.ONE_TO_MANY),
                (r'@ManyToOne\s*\([^)]*\)\s*(\w+)\s*[?!]?\s*:\s*(\w+)', RelationType.MANY_TO_ONE),
                (r'@ManyToMany\s*\([^)]*\)\s*(\w+)\s*[?!]?\s*:\s*(\w+)', RelationType.MANY_TO_MANY),
            ]

            for pattern, rel_type in rel_patterns:
                for rel_match in re.finditer(pattern, class_body):
                    field_name = rel_match.group(1)
                    target_type = rel_match.group(2).replace('[]', '')

                    relationships.append(Relationship(
                        source_entity=class_name,
                        target_entity=target_type,
                        relation_type=rel_type,
                        source_field=field_name
                    ))

            # Parse @JoinColumn for FK
            join_pattern = r'@JoinColumn\s*\([^)]*name:\s*["\'](\w+)["\'][^)]*\)'
            for join_match in re.finditer(join_pattern, class_body):
                fk_name = join_match.group(1)
                fields.append(Field(
                    name=fk_name,
                    field_type='int',
                    is_foreign_key=True
                ))

            if fields:
                entities.append(Entity(
                    name=class_name,
                    fields=fields,
                    file_path=file_path
                ))

        return entities, relationships


class DjangoParser:
    """Parse Django models.py files"""

    def parse(self, content: str, file_path: str = None) -> Tuple[List[Entity], List[Relationship]]:
        entities = []
        relationships = []

        # Find model classes
        class_pattern = r'class\s+(\w+)\s*\(\s*(?:models\.)?Model\s*\)\s*:\s*((?:\n(?:[ \t]+[^\n]+))*)'
        matches = re.finditer(class_pattern, content, re.MULTILINE)

        for match in matches:
            class_name = match.group(1)
            class_body = match.group(2)
            fields = []

            # Add implicit id field
            if 'id = ' not in class_body:
                fields.append(Field(
                    name='id',
                    field_type='int',
                    is_primary_key=True,
                    is_nullable=False,
                    is_unique=True
                ))

            # Parse field definitions
            field_pattern = r'(\w+)\s*=\s*models\.(\w+)\s*\(([^)]*)\)'
            for field_match in re.finditer(field_pattern, class_body):
                field_name = field_match.group(1)
                field_type = field_match.group(2)
                field_args = field_match.group(3)

                is_nullable = 'null=True' in field_args
                is_unique = 'unique=True' in field_args
                is_pk = 'primary_key=True' in field_args

                # Handle relationship fields
                if field_type in ['ForeignKey', 'OneToOneField']:
                    # Extract target model
                    target_match = re.search(r"['\"]?(\w+)['\"]?", field_args)
                    if target_match:
                        target = target_match.group(1)
                        if target == 'self':
                            target = class_name

                        rel_type = RelationType.ONE_TO_ONE if field_type == 'OneToOneField' else RelationType.MANY_TO_ONE
                        relationships.append(Relationship(
                            source_entity=class_name,
                            target_entity=target,
                            relation_type=rel_type,
                            source_field=field_name
                        ))

                        fields.append(Field(
                            name=f"{field_name}_id",
                            field_type='int',
                            is_foreign_key=True,
                            is_nullable=is_nullable,
                            references=f"{target}.id"
                        ))
                    continue

                elif field_type == 'ManyToManyField':
                    target_match = re.search(r"['\"]?(\w+)['\"]?", field_args)
                    if target_match:
                        target = target_match.group(1)
                        relationships.append(Relationship(
                            source_entity=class_name,
                            target_entity=target,
                            relation_type=RelationType.MANY_TO_MANY,
                            source_field=field_name
                        ))
                    continue

                # Map Django field types
                type_map = {
                    'CharField': 'string', 'TextField': 'text', 'IntegerField': 'int',
                    'BigIntegerField': 'int', 'SmallIntegerField': 'int',
                    'FloatField': 'float', 'DecimalField': 'float',
                    'BooleanField': 'boolean', 'NullBooleanField': 'boolean',
                    'DateTimeField': 'datetime', 'DateField': 'date', 'TimeField': 'time',
                    'JSONField': 'json', 'UUIDField': 'uuid', 'BinaryField': 'binary',
                    'EmailField': 'string', 'URLField': 'string', 'SlugField': 'string',
                    'AutoField': 'int', 'BigAutoField': 'int',
                }

                fields.append(Field(
                    name=field_name,
                    field_type=type_map.get(field_type, field_type.lower()),
                    is_primary_key=is_pk,
                    is_nullable=is_nullable,
                    is_unique=is_unique
                ))

            entities.append(Entity(
                name=class_name,
                fields=fields,
                file_path=file_path
            ))

        return entities, relationships


class MongooseParser:
    """Parse Mongoose schema files"""

    def parse(self, content: str, file_path: str = None) -> Tuple[List[Entity], List[Relationship]]:
        entities = []
        relationships = []

        # Find Schema definitions
        schema_pattern = r'(?:const|let|var)\s+(\w+)Schema\s*=\s*new\s+(?:mongoose\.)?Schema\s*\(\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}'
        matches = re.finditer(schema_pattern, content, re.MULTILINE | re.DOTALL)

        for match in matches:
            schema_name = match.group(1)
            schema_body = match.group(2)
            fields = []

            # Add implicit _id field
            fields.append(Field(
                name='_id',
                field_type='uuid',
                is_primary_key=True,
                is_nullable=False,
                is_unique=True
            ))

            # Parse field definitions (simplified)
            # Handle: fieldName: Type or fieldName: { type: Type, ... }
            field_patterns = [
                r"(\w+)\s*:\s*\{\s*type\s*:\s*(\w+)[^}]*ref\s*:\s*['\"](\w+)['\"]",  # with ref
                r"(\w+)\s*:\s*\{\s*type\s*:\s*(\w+)",  # object style
                r"(\w+)\s*:\s*(\w+)(?:\s*,|\s*$|\s*\})",  # shorthand style
            ]

            seen_fields = {'_id'}

            # First pass: fields with refs (relationships)
            ref_pattern = r"(\w+)\s*:\s*\{\s*type\s*:\s*(?:mongoose\.)?Schema\.Types\.ObjectId[^}]*ref\s*:\s*['\"](\w+)['\"]"
            for ref_match in re.finditer(ref_pattern, schema_body):
                field_name = ref_match.group(1)
                ref_target = ref_match.group(2)
                seen_fields.add(field_name)

                fields.append(Field(
                    name=field_name,
                    field_type='uuid',
                    is_foreign_key=True,
                    references=f"{ref_target}._id"
                ))

                relationships.append(Relationship(
                    source_entity=schema_name,
                    target_entity=ref_target,
                    relation_type=RelationType.MANY_TO_ONE,
                    source_field=field_name
                ))

            # Second pass: regular fields
            simple_pattern = r"(\w+)\s*:\s*(?:\{\s*type\s*:\s*)?(\w+)"
            for field_match in re.finditer(simple_pattern, schema_body):
                field_name = field_match.group(1)
                field_type = field_match.group(2)

                if field_name in seen_fields or field_name in ['type', 'ref', 'required', 'default', 'unique']:
                    continue
                seen_fields.add(field_name)

                # Map Mongoose types
                type_map = {
                    'String': 'string', 'Number': 'float', 'Boolean': 'boolean',
                    'Date': 'datetime', 'Buffer': 'binary', 'ObjectId': 'uuid',
                    'Mixed': 'json', 'Array': 'json', 'Map': 'json'
                }

                fields.append(Field(
                    name=field_name,
                    field_type=type_map.get(field_type, field_type.lower())
                ))

            entities.append(Entity(
                name=schema_name,
                fields=fields,
                file_path=file_path
            ))

        return entities, relationships


class JPAParser:
    """Parse JPA/Hibernate entity files"""

    def parse(self, content: str, file_path: str = None) -> Tuple[List[Entity], List[Relationship]]:
        entities = []
        relationships = []

        # Find @Entity annotated classes
        entity_pattern = r'@Entity[^@]*(?:@Table[^@]*)?\s*public\s+class\s+(\w+)[^{]*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}'
        matches = re.finditer(entity_pattern, content, re.MULTILINE | re.DOTALL)

        for match in matches:
            class_name = match.group(1)
            class_body = match.group(2)
            fields = []

            # Parse field/getter annotations
            column_pattern = r'(?:@(?:Id|GeneratedValue|Column)[^;]*)*\s*private\s+(\w+)\s+(\w+)\s*;'
            for col_match in re.finditer(column_pattern, class_body):
                col_type = col_match.group(1)
                col_name = col_match.group(2)

                # Check annotations before this field
                before_field = class_body[:col_match.start()]
                is_pk = '@Id' in before_field[-200:]

                # Map Java types
                type_map = {
                    'String': 'string', 'Integer': 'int', 'int': 'int',
                    'Long': 'int', 'long': 'int', 'Double': 'float', 'double': 'float',
                    'Float': 'float', 'float': 'float', 'Boolean': 'boolean', 'boolean': 'boolean',
                    'Date': 'date', 'LocalDate': 'date', 'LocalDateTime': 'datetime',
                    'Timestamp': 'datetime', 'UUID': 'uuid', 'BigDecimal': 'float'
                }

                fields.append(Field(
                    name=col_name,
                    field_type=type_map.get(col_type, col_type.lower()),
                    is_primary_key=is_pk
                ))

            # Parse relationship annotations
            rel_patterns = [
                (r'@OneToOne[^;]*private\s+(\w+)\s+(\w+)\s*;', RelationType.ONE_TO_ONE),
                (r'@OneToMany[^;]*private\s+(?:List|Set|Collection)<(\w+)>\s+(\w+)\s*;', RelationType.ONE_TO_MANY),
                (r'@ManyToOne[^;]*private\s+(\w+)\s+(\w+)\s*;', RelationType.MANY_TO_ONE),
                (r'@ManyToMany[^;]*private\s+(?:List|Set|Collection)<(\w+)>\s+(\w+)\s*;', RelationType.MANY_TO_MANY),
            ]

            for pattern, rel_type in rel_patterns:
                for rel_match in re.finditer(pattern, class_body):
                    target_type = rel_match.group(1)
                    field_name = rel_match.group(2)

                    relationships.append(Relationship(
                        source_entity=class_name,
                        target_entity=target_type,
                        relation_type=rel_type,
                        source_field=field_name
                    ))

            if fields:
                entities.append(Entity(
                    name=class_name,
                    fields=fields,
                    file_path=file_path
                ))

        return entities, relationships


class ERDGenerator:
    """Main ERD generator that uses appropriate parser based on file type"""

    PARSERS = {
        '.prisma': PrismaParser,
        '.py': SQLAlchemyParser,  # Also handles Django
        '.ts': TypeORMParser,
        '.js': MongooseParser,
        '.java': JPAParser,
    }

    def __init__(self, root_path: str, services: List[Dict] = None):
        self.root_path = Path(root_path).resolve()
        self.services = services or []
        self.entities: List[Entity] = []
        self.relationships: List[Relationship] = []

    def detect_orm_files(self, service_path: Path) -> List[Tuple[Path, str]]:
        """Find files likely containing ORM definitions"""
        orm_files = []

        # Prisma
        for f in service_path.glob('**/schema.prisma'):
            orm_files.append((f, '.prisma'))
        for f in service_path.glob('**/*.prisma'):
            orm_files.append((f, '.prisma'))

        # Python (SQLAlchemy/Django)
        for pattern in ['**/models.py', '**/models/*.py', '**/entities.py', '**/entities/*.py']:
            for f in service_path.glob(pattern):
                if 'test' not in str(f).lower() and '__pycache__' not in str(f):
                    orm_files.append((f, '.py'))

        # TypeScript (TypeORM)
        for pattern in ['**/entities/*.ts', '**/*.entity.ts', '**/models/*.ts']:
            for f in service_path.glob(pattern):
                if 'node_modules' not in str(f) and 'test' not in str(f).lower():
                    orm_files.append((f, '.ts'))

        # JavaScript (Mongoose/Sequelize)
        for pattern in ['**/models/*.js', '**/*.model.js', '**/schemas/*.js']:
            for f in service_path.glob(pattern):
                if 'node_modules' not in str(f) and 'test' not in str(f).lower():
                    orm_files.append((f, '.js'))

        # Java (JPA/Hibernate)
        for pattern in ['**/entity/*.java', '**/entities/*.java', '**/*Entity.java']:
            for f in service_path.glob(pattern):
                if 'test' not in str(f).lower():
                    orm_files.append((f, '.java'))

        return orm_files

    def parse_file(self, file_path: Path, ext: str, service_name: str) -> None:
        """Parse a single file and extract entities/relationships"""
        try:
            content = file_path.read_text(errors='ignore')

            # Special detection for Django vs SQLAlchemy
            if ext == '.py':
                if 'from django' in content or 'models.Model' in content:
                    parser = DjangoParser()
                else:
                    parser = SQLAlchemyParser()
            # Special detection for Mongoose vs TypeORM
            elif ext == '.js':
                if 'mongoose' in content.lower() or 'Schema' in content:
                    parser = MongooseParser()
                else:
                    return  # Skip non-ORM JS files
            elif ext == '.ts':
                if '@Entity' in content or 'typeorm' in content.lower():
                    parser = TypeORMParser()
                else:
                    return  # Skip non-ORM TS files
            else:
                parser_class = self.PARSERS.get(ext)
                if not parser_class:
                    return
                parser = parser_class()

            entities, relationships = parser.parse(content, str(file_path))

            # Tag entities with service name
            for entity in entities:
                entity.service = service_name
                entity.file_path = str(file_path.relative_to(self.root_path))

            self.entities.extend(entities)
            self.relationships.extend(relationships)

        except Exception as e:
            print(f"Error parsing {file_path}: {e}")

    def generate(self) -> Dict:
        """Generate ERD data from all services"""
        for service in self.services:
            service_name = service.get('name', '')
            service_path = self.root_path / service.get('path', '')

            if not service_path.exists():
                continue

            print(f"Scanning for ORM models in: {service_name}")

            orm_files = self.detect_orm_files(service_path)
            for file_path, ext in orm_files:
                self.parse_file(file_path, ext, service_name)

        # Deduplicate relationships
        unique_rels = {}
        for rel in self.relationships:
            key = (rel.source_entity, rel.target_entity, rel.relation_type)
            if key not in unique_rels:
                unique_rels[key] = rel
        self.relationships = list(unique_rels.values())

        return {
            'total_entities': len(self.entities),
            'total_relationships': len(self.relationships),
            'entities': [e.to_dict() for e in self.entities],
            'relationships': [r.to_dict() for r in self.relationships],
            'by_service': self._group_by_service(),
        }

    def _group_by_service(self) -> Dict[str, List[str]]:
        """Group entities by service"""
        grouped = defaultdict(list)
        for entity in self.entities:
            grouped[entity.service or 'unknown'].append(entity.name)
        return dict(grouped)


def format_mermaid(data: Dict) -> str:
    """Format ERD as Mermaid diagram"""
    output = """# Entity Relationship Diagram

```mermaid
erDiagram
"""

    # Add entities with their fields
    for entity in data['entities']:
        output += f"    {entity['name']} {{\n"
        for field in entity['fields']:
            pk = "PK" if field['is_primary_key'] else ""
            fk = "FK" if field['is_foreign_key'] else ""
            key_marker = f"{pk}{fk}" if pk or fk else ""
            output += f"        {field['field_type']} {field['name']}"
            if key_marker:
                output += f" {key_marker}"
            output += "\n"
        output += "    }\n"

    output += "\n"

    # Add relationships
    for rel in data['relationships']:
        # Mermaid ERD relationship syntax
        rel_map = {
            "1--1": "||--||",
            "1--*": "||--o{",
            "*--1": "}o--||",
            "*--*": "}o--o{"
        }
        mermaid_rel = rel_map.get(rel['relation_type'], "--")
        label = rel.get('name') or rel.get('source_field') or ""

        output += f"    {rel['source_entity']} {mermaid_rel} {rel['target_entity']} : \"{label}\"\n"

    output += "```\n"

    # Add summary
    output += f"""
## Summary

- **Total Entities**: {data['total_entities']}
- **Total Relationships**: {data['total_relationships']}

## Entities by Service

"""

    for service, entities in data['by_service'].items():
        output += f"### {service}\n"
        for entity in entities:
            output += f"- {entity}\n"
        output += "\n"

    return output


def format_plantuml(data: Dict) -> str:
    """Format ERD as PlantUML diagram"""
    output = """@startuml ERD

!define TABLE(name) entity name << (T,#FFAAAA) >>
!define PK(x) <b>x</b>
!define FK(x) <i>x</i>

skinparam entity {
    BackgroundColor AliceBlue
    BorderColor DarkSlateGray
}

"""

    for entity in data['entities']:
        output += f"TABLE({entity['name']}) {{\n"
        for field in entity['fields']:
            if field['is_primary_key']:
                output += f"    PK({field['name']}) : {field['field_type']}\n"
            elif field['is_foreign_key']:
                output += f"    FK({field['name']}) : {field['field_type']}\n"
            else:
                output += f"    {field['name']} : {field['field_type']}\n"
        output += "}\n\n"

    for rel in data['relationships']:
        rel_map = {
            "1--1": "||--||",
            "1--*": "||--o{",
            "*--1": "}o--||",
            "*--*": "}o--o{"
        }
        puml_rel = rel_map.get(rel['relation_type'], "--")
        output += f"{rel['source_entity']} {puml_rel} {rel['target_entity']}\n"

    output += "\n@enduml\n"
    return output


def format_dot(data: Dict) -> str:
    """Format ERD as DOT (Graphviz) diagram"""
    output = """digraph ERD {
    graph [rankdir=LR, splines=ortho];
    node [shape=record, fontname="Helvetica"];
    edge [fontname="Helvetica"];

"""

    for entity in data['entities']:
        fields_str = "|".join([
            f"<{f['name']}> {'🔑 ' if f['is_primary_key'] else '🔗 ' if f['is_foreign_key'] else ''}{f['name']}: {f['field_type']}"
            for f in entity['fields']
        ])
        output += f'    {entity["name"]} [label="{{{entity["name"]}|{fields_str}}}"];\n'

    output += "\n"

    for rel in data['relationships']:
        # DOT arrow styles for relationships
        style = 'arrowhead="crow"' if '*' in rel['relation_type'] else 'arrowhead="tee"'
        output += f'    {rel["source_entity"]} -> {rel["target_entity"]} [{style}];\n'

    output += "}\n"
    return output


def main():
    parser = argparse.ArgumentParser(description='Generate ERD from ORM model definitions')
    parser.add_argument('path', nargs='?', default='.', help='Repository path to analyze')
    parser.add_argument('--services', '-s', help='Services JSON file from analyze_structure.py')
    parser.add_argument('--output', '-o', help='Output file')
    parser.add_argument('--format', '-f', choices=['mermaid', 'plantuml', 'dot', 'json'],
                       default='mermaid', help='Output format')

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
            services = [{'name': Path(args.path).name, 'path': '.'}]

    if not services:
        services = [{'name': Path(args.path).name, 'path': '.'}]

    # Generate ERD
    generator = ERDGenerator(args.path, services)
    result = generator.generate()

    if result['total_entities'] == 0:
        print("No entities found. Make sure ORM model files exist in expected locations:")
        print("  - Prisma: schema.prisma")
        print("  - SQLAlchemy/Django: models.py, entities.py")
        print("  - TypeORM: *.entity.ts, entities/*.ts")
        print("  - Mongoose: models/*.js, *.model.js")
        print("  - JPA: *Entity.java, entity/*.java")
        return

    # Format output
    if args.format == 'json':
        output = json.dumps(result, indent=2)
    elif args.format == 'plantuml':
        output = format_plantuml(result)
    elif args.format == 'dot':
        output = format_dot(result)
    else:
        output = format_mermaid(result)

    if args.output:
        with open(args.output, 'w') as f:
            f.write(output)
        print(f"ERD written to {args.output}")
    else:
        print(output)


if __name__ == '__main__':
    main()

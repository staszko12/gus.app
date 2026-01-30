#!/usr/bin/env python3
"""
MCP Server for BDL API (Bank Danych Lokalnych - Local Data Bank)
GUS (Statistics Poland) API

This server provides access to Polish statistical data through the Model Context Protocol.
"""

import asyncio
import json
import logging
from typing import Any, Optional
from urllib.parse import urlencode

import httpx
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import (
    Tool,
    TextContent,
    CallToolResult,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("bdl-mcp-server")

# BDL API Base URL
BASE_URL = "https://bdl.stat.gov.pl/api/v1"

# Initialize MCP server
server = Server("bdl-api")


class BDLClient:
    """HTTP client for BDL API"""
    
    def __init__(self, base_url: str = BASE_URL, lang: str = "pl"):
        self.base_url = base_url
        self.lang = lang
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "User-Agent": "BDL-MCP-Server/0.1.0",
                "Accept": "application/json",
            }
        )
    
    async def close(self):
        await self.client.aclose()
    
    async def request(
        self,
        endpoint: str,
        params: Optional[dict] = None,
        lang: Optional[str] = None
    ) -> dict:
        """Make a request to BDL API"""
        if params is None:
            params = {}
        
        # Add language parameter
        params["lang"] = lang or self.lang
        params["format"] = "json"
        
        # Filter out None values
        params = {k: v for k, v in params.items() if v is not None}
        
        url = f"{self.base_url}{endpoint}"
        
        logger.info(f"Request: {url}?{urlencode(params)}")
        
        try:
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error: {e}")
            return {"error": str(e), "status_code": e.response.status_code}
        except Exception as e:
            logger.error(f"Request error: {e}")
            return {"error": str(e)}


# Global client instance
bdl_client = BDLClient()


# ============================================================================
# Tool Definitions
# ============================================================================

TOOLS = [
    # Aggregates
    Tool(
        name="get_aggregates",
        description="Pobiera listę poziomów agregacji danych (np. kraj, województwo, powiat, gmina) / Get list of aggregation levels (e.g., country, voivodeship, district, commune)",
        inputSchema={
            "type": "object",
            "properties": {
                "sort": {
                    "type": "string",
                    "description": "Kolejność sortowania / Sort order",
                    "enum": ["Id", "-Id", "Name", "-Name"]
                },
                "lang": {
                    "type": "string",
                    "description": "Język odpowiedzi / Response language",
                    "enum": ["pl", "en"]
                }
            }
        }
    ),
    Tool(
        name="get_aggregate_by_id",
        description="Pobiera szczegóły poziomu agregacji o podanym ID / Get aggregation level details by ID",
        inputSchema={
            "type": "object",
            "properties": {
                "id": {
                    "type": "integer",
                    "description": "ID poziomu agregacji / Aggregation level ID"
                },
                "lang": {
                    "type": "string",
                    "description": "Język odpowiedzi / Response language",
                    "enum": ["pl", "en"]
                }
            },
            "required": ["id"]
        }
    ),
    
    # Attributes
    Tool(
        name="get_attributes",
        description="Pobiera listę atrybutów danych statystycznych / Get list of statistical data attributes",
        inputSchema={
            "type": "object",
            "properties": {
                "sort": {
                    "type": "string",
                    "description": "Kolejność sortowania / Sort order",
                    "enum": ["Id", "-Id", "Name", "-Name"]
                },
                "lang": {
                    "type": "string",
                    "description": "Język odpowiedzi / Response language",
                    "enum": ["pl", "en"]
                }
            }
        }
    ),
    Tool(
        name="get_attribute_by_id",
        description="Pobiera szczegóły atrybutu o podanym ID / Get attribute details by ID",
        inputSchema={
            "type": "object",
            "properties": {
                "id": {
                    "type": "integer",
                    "description": "ID atrybutu / Attribute ID"
                },
                "lang": {
                    "type": "string",
                    "description": "Język odpowiedzi / Response language",
                    "enum": ["pl", "en"]
                }
            },
            "required": ["id"]
        }
    ),
    
    # Data
    Tool(
        name="get_data_by_variable",
        description="Pobiera dane statystyczne dla jednej zmiennej / Get statistical data for a single variable",
        inputSchema={
            "type": "object",
            "properties": {
                "var_id": {
                    "type": "integer",
                    "description": "ID zmiennej / Variable ID"
                },
                "unit_id": {
                    "type": "string",
                    "description": "ID jednostki terytorialnej (opcjonalnie) / Territorial unit ID (optional)"
                },
                "unit_level": {
                    "type": "integer",
                    "description": "Poziom jednostki terytorialnej / Territorial unit level"
                },
                "aggregate_id": {
                    "type": "integer",
                    "description": "ID poziomu agregacji / Aggregation level ID"
                },
                "year": {
                    "type": "array",
                    "items": {"type": "integer"},
                    "description": "Lista lat / List of years"
                },
                "page": {
                    "type": "integer",
                    "description": "Numer strony (od 0) / Page number (from 0)"
                },
                "page_size": {
                    "type": "integer",
                    "description": "Rozmiar strony / Page size"
                },
                "lang": {
                    "type": "string",
                    "description": "Język odpowiedzi / Response language",
                    "enum": ["pl", "en"]
                }
            },
            "required": ["var_id"]
        }
    ),
    Tool(
        name="get_data_by_unit",
        description="Pobiera dane statystyczne dla jednostki terytorialnej / Get statistical data for a territorial unit",
        inputSchema={
            "type": "object",
            "properties": {
                "unit_id": {
                    "type": "string",
                    "description": "ID jednostki terytorialnej / Territorial unit ID"
                },
                "var_id": {
                    "type": "array",
                    "items": {"type": "integer"},
                    "description": "Lista ID zmiennych / List of variable IDs"
                },
                "year": {
                    "type": "array",
                    "items": {"type": "integer"},
                    "description": "Lista lat / List of years"
                },
                "aggregate_id": {
                    "type": "integer",
                    "description": "ID poziomu agregacji / Aggregation level ID"
                },
                "page": {
                    "type": "integer",
                    "description": "Numer strony (od 0) / Page number (from 0)"
                },
                "page_size": {
                    "type": "integer",
                    "description": "Rozmiar strony / Page size"
                },
                "lang": {
                    "type": "string",
                    "description": "Język odpowiedzi / Response language",
                    "enum": ["pl", "en"]
                }
            },
            "required": ["unit_id", "var_id"]
        }
    ),
    Tool(
        name="get_data_localities_by_unit",
        description="Pobiera dane dla miejscowości statystycznej / Get data for a statistical locality",
        inputSchema={
            "type": "object",
            "properties": {
                "unit_id": {
                    "type": "string",
                    "description": "ID miejscowości statystycznej / Statistical locality ID"
                },
                "var_id": {
                    "type": "array",
                    "items": {"type": "integer"},
                    "description": "Lista ID zmiennych / List of variable IDs"
                },
                "year": {
                    "type": "array",
                    "items": {"type": "integer"},
                    "description": "Lista lat / List of years"
                },
                "aggregate_id": {
                    "type": "integer",
                    "description": "ID poziomu agregacji / Aggregation level ID"
                },
                "page": {
                    "type": "integer",
                    "description": "Numer strony / Page number"
                },
                "page_size": {
                    "type": "integer",
                    "description": "Rozmiar strony / Page size"
                },
                "lang": {
                    "type": "string",
                    "description": "Język odpowiedzi / Response language",
                    "enum": ["pl", "en"]
                }
            },
            "required": ["unit_id", "var_id"]
        }
    ),
    
    # Levels
    Tool(
        name="get_levels",
        description="Pobiera listę poziomów jednostek terytorialnych / Get list of territorial unit levels",
        inputSchema={
            "type": "object",
            "properties": {
                "sort": {
                    "type": "string",
                    "description": "Kolejność sortowania / Sort order",
                    "enum": ["Id", "-Id", "Name", "-Name"]
                },
                "lang": {
                    "type": "string",
                    "description": "Język odpowiedzi / Response language",
                    "enum": ["pl", "en"]
                }
            }
        }
    ),
    Tool(
        name="get_level_by_id",
        description="Pobiera szczegóły poziomu jednostki terytorialnej / Get territorial unit level details",
        inputSchema={
            "type": "object",
            "properties": {
                "id": {
                    "type": "integer",
                    "description": "ID poziomu / Level ID"
                },
                "lang": {
                    "type": "string",
                    "description": "Język odpowiedzi / Response language",
                    "enum": ["pl", "en"]
                }
            },
            "required": ["id"]
        }
    ),
    
    # Measures
    Tool(
        name="get_measures",
        description="Pobiera listę jednostek miar / Get list of measure units",
        inputSchema={
            "type": "object",
            "properties": {
                "sort": {
                    "type": "string",
                    "description": "Kolejność sortowania / Sort order",
                    "enum": ["Id", "-Id", "Name", "-Name"]
                },
                "lang": {
                    "type": "string",
                    "description": "Język odpowiedzi / Response language",
                    "enum": ["pl", "en"]
                }
            }
        }
    ),
    Tool(
        name="get_measure_by_id",
        description="Pobiera szczegóły jednostki miary / Get measure unit details",
        inputSchema={
            "type": "object",
            "properties": {
                "id": {
                    "type": "integer",
                    "description": "ID jednostki miary / Measure unit ID"
                },
                "lang": {
                    "type": "string",
                    "description": "Język odpowiedzi / Response language",
                    "enum": ["pl", "en"]
                }
            },
            "required": ["id"]
        }
    ),
    
    # Subjects
    Tool(
        name="get_subjects",
        description="Pobiera listę tematów (kategorii danych) / Get list of subjects (data categories)",
        inputSchema={
            "type": "object",
            "properties": {
                "parent_id": {
                    "type": "string",
                    "description": "ID tematu nadrzędnego / Parent subject ID"
                },
                "page": {
                    "type": "integer",
                    "description": "Numer strony / Page number"
                },
                "page_size": {
                    "type": "integer",
                    "description": "Rozmiar strony / Page size"
                },
                "sort": {
                    "type": "string",
                    "description": "Kolejność sortowania / Sort order",
                    "enum": ["Id", "-Id", "Name", "-Name"]
                },
                "lang": {
                    "type": "string",
                    "description": "Język odpowiedzi / Response language",
                    "enum": ["pl", "en"]
                }
            }
        }
    ),
    Tool(
        name="get_subject_by_id",
        description="Pobiera szczegóły tematu / Get subject details",
        inputSchema={
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "ID tematu / Subject ID"
                },
                "lang": {
                    "type": "string",
                    "description": "Język odpowiedzi / Response language",
                    "enum": ["pl", "en"]
                }
            },
            "required": ["id"]
        }
    ),
    
    # Units (Territorial)
    Tool(
        name="get_units",
        description="Pobiera listę jednostek terytorialnych (województwa, powiaty, gminy) / Get list of territorial units (voivodeships, districts, communes)",
        inputSchema={
            "type": "object",
            "properties": {
                "parent_id": {
                    "type": "string",
                    "description": "ID jednostki nadrzędnej / Parent unit ID"
                },
                "level": {
                    "type": "integer",
                    "description": "Poziom jednostki (1-6) / Unit level (1-6)"
                },
                "name": {
                    "type": "string",
                    "description": "Nazwa jednostki (do wyszukiwania) / Unit name (for search)"
                },
                "year": {
                    "type": "array",
                    "items": {"type": "integer"},
                    "description": "Lista lat / List of years"
                },
                "kind": {
                    "type": "string",
                    "description": "Rodzaj jednostki / Unit kind"
                },
                "page": {
                    "type": "integer",
                    "description": "Numer strony / Page number"
                },
                "page_size": {
                    "type": "integer",
                    "description": "Rozmiar strony / Page size"
                },
                "sort": {
                    "type": "string",
                    "description": "Kolejność sortowania / Sort order",
                    "enum": ["Id", "-Id", "Name", "-Name"]
                },
                "lang": {
                    "type": "string",
                    "description": "Język odpowiedzi / Response language",
                    "enum": ["pl", "en"]
                }
            }
        }
    ),
    Tool(
        name="get_unit_by_id",
        description="Pobiera szczegóły jednostki terytorialnej / Get territorial unit details",
        inputSchema={
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "ID jednostki terytorialnej / Territorial unit ID"
                },
                "lang": {
                    "type": "string",
                    "description": "Język odpowiedzi / Response language",
                    "enum": ["pl", "en"]
                }
            },
            "required": ["id"]
        }
    ),
    Tool(
        name="search_units",
        description="Wyszukuje jednostki terytorialne po nazwie / Search territorial units by name",
        inputSchema={
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Nazwa do wyszukania / Name to search"
                },
                "level": {
                    "type": "integer",
                    "description": "Poziom jednostki / Unit level"
                },
                "year": {
                    "type": "array",
                    "items": {"type": "integer"},
                    "description": "Lista lat / List of years"
                },
                "page": {
                    "type": "integer",
                    "description": "Numer strony / Page number"
                },
                "page_size": {
                    "type": "integer",
                    "description": "Rozmiar strony / Page size"
                },
                "lang": {
                    "type": "string",
                    "description": "Język odpowiedzi / Response language",
                    "enum": ["pl", "en"]
                }
            },
            "required": ["name"]
        }
    ),
    Tool(
        name="get_localities",
        description="Pobiera listę miejscowości statystycznych / Get list of statistical localities",
        inputSchema={
            "type": "object",
            "properties": {
                "parent_id": {
                    "type": "string",
                    "description": "ID jednostki nadrzędnej (gminy) / Parent unit ID (commune)"
                },
                "page": {
                    "type": "integer",
                    "description": "Numer strony / Page number"
                },
                "page_size": {
                    "type": "integer",
                    "description": "Rozmiar strony / Page size"
                },
                "lang": {
                    "type": "string",
                    "description": "Język odpowiedzi / Response language",
                    "enum": ["pl", "en"]
                }
            },
            "required": ["parent_id"]
        }
    ),
    
    # Variables
    Tool(
        name="get_variables",
        description="Pobiera listę zmiennych (cech statystycznych) dla tematu / Get list of variables (statistical features) for a subject",
        inputSchema={
            "type": "object",
            "properties": {
                "subject_id": {
                    "type": "string",
                    "description": "ID tematu / Subject ID"
                },
                "level": {
                    "type": "integer",
                    "description": "Poziom agregacji / Aggregation level"
                },
                "year": {
                    "type": "array",
                    "items": {"type": "integer"},
                    "description": "Lista lat / List of years"
                },
                "page": {
                    "type": "integer",
                    "description": "Numer strony / Page number"
                },
                "page_size": {
                    "type": "integer",
                    "description": "Rozmiar strony / Page size"
                },
                "sort": {
                    "type": "string",
                    "description": "Kolejność sortowania / Sort order",
                    "enum": ["Id", "-Id", "SubjectId", "-SubjectId"]
                },
                "lang": {
                    "type": "string",
                    "description": "Język odpowiedzi / Response language",
                    "enum": ["pl", "en"]
                }
            }
        }
    ),
    Tool(
        name="get_variable_by_id",
        description="Pobiera szczegóły zmiennej / Get variable details",
        inputSchema={
            "type": "object",
            "properties": {
                "id": {
                    "type": "integer",
                    "description": "ID zmiennej / Variable ID"
                },
                "lang": {
                    "type": "string",
                    "description": "Język odpowiedzi / Response language",
                    "enum": ["pl", "en"]
                }
            },
            "required": ["id"]
        }
    ),
    Tool(
        name="search_variables",
        description="Wyszukuje zmienne według warunków / Search variables by conditions",
        inputSchema={
            "type": "object",
            "properties": {
                "subject_id": {
                    "type": "string",
                    "description": "ID tematu / Subject ID"
                },
                "name": {
                    "type": "string",
                    "description": "Tekst do wyszukania w nazwach / Text to search in names"
                },
                "level": {
                    "type": "integer",
                    "description": "Poziom agregacji / Aggregation level"
                },
                "year": {
                    "type": "array",
                    "items": {"type": "integer"},
                    "description": "Lista lat / List of years"
                },
                "page": {
                    "type": "integer",
                    "description": "Numer strony / Page number"
                },
                "page_size": {
                    "type": "integer",
                    "description": "Rozmiar strony / Page size"
                },
                "sort": {
                    "type": "string",
                    "description": "Kolejność sortowania / Sort order",
                    "enum": ["Id", "-Id", "SubjectId", "-SubjectId"]
                },
                "lang": {
                    "type": "string",
                    "description": "Język odpowiedzi / Response language",
                    "enum": ["pl", "en"]
                }
            }
        }
    ),
    
    # Years
    Tool(
        name="get_years",
        description="Pobiera listę lat dla których dostępne są dane / Get list of years with available data",
        inputSchema={
            "type": "object",
            "properties": {
                "sort": {
                    "type": "string",
                    "description": "Kolejność sortowania / Sort order",
                    "enum": ["Id", "-Id"]
                },
                "lang": {
                    "type": "string",
                    "description": "Język odpowiedzi / Response language",
                    "enum": ["pl", "en"]
                }
            }
        }
    ),
    Tool(
        name="get_year_by_id",
        description="Pobiera szczegóły roku / Get year details",
        inputSchema={
            "type": "object",
            "properties": {
                "id": {
                    "type": "integer",
                    "description": "Rok / Year"
                },
                "lang": {
                    "type": "string",
                    "description": "Język odpowiedzi / Response language",
                    "enum": ["pl", "en"]
                }
            },
            "required": ["id"]
        }
    ),
]


# ============================================================================
# Tool Handlers
# ============================================================================

async def handle_get_aggregates(arguments: dict) -> dict:
    params = {
        "sort": arguments.get("sort"),
    }
    return await bdl_client.request("/aggregates", params, arguments.get("lang"))


async def handle_get_aggregate_by_id(arguments: dict) -> dict:
    aggregate_id = arguments["id"]
    return await bdl_client.request(f"/aggregates/{aggregate_id}", lang=arguments.get("lang"))


async def handle_get_attributes(arguments: dict) -> dict:
    params = {
        "sort": arguments.get("sort"),
    }
    return await bdl_client.request("/attributes", params, arguments.get("lang"))


async def handle_get_attribute_by_id(arguments: dict) -> dict:
    attr_id = arguments["id"]
    return await bdl_client.request(f"/attributes/{attr_id}", lang=arguments.get("lang"))


async def handle_get_data_by_variable(arguments: dict) -> dict:
    var_id = arguments["var_id"]
    params = {
        "unit-id": arguments.get("unit_id"),
        "unit-level": arguments.get("unit_level"),
        "aggregate-id": arguments.get("aggregate_id"),
        "year": arguments.get("year"),
        "page": arguments.get("page"),
        "page-size": arguments.get("page_size"),
    }
    return await bdl_client.request(f"/data/by-variable/{var_id}", params, arguments.get("lang"))


async def handle_get_data_by_unit(arguments: dict) -> dict:
    unit_id = arguments["unit_id"]
    params = {
        "var-id": arguments["var_id"],
        "year": arguments.get("year"),
        "aggregate-id": arguments.get("aggregate_id"),
        "page": arguments.get("page"),
        "page-size": arguments.get("page_size"),
    }
    return await bdl_client.request(f"/data/by-unit/{unit_id}", params, arguments.get("lang"))


async def handle_get_data_localities_by_unit(arguments: dict) -> dict:
    unit_id = arguments["unit_id"]
    params = {
        "var-id": arguments["var_id"],
        "year": arguments.get("year"),
        "aggregate-id": arguments.get("aggregate_id"),
        "page": arguments.get("page"),
        "page-size": arguments.get("page_size"),
    }
    return await bdl_client.request(f"/data/localities/by-unit/{unit_id}", params, arguments.get("lang"))


async def handle_get_levels(arguments: dict) -> dict:
    params = {
        "sort": arguments.get("sort"),
    }
    return await bdl_client.request("/levels", params, arguments.get("lang"))


async def handle_get_level_by_id(arguments: dict) -> dict:
    level_id = arguments["id"]
    return await bdl_client.request(f"/levels/{level_id}", lang=arguments.get("lang"))


async def handle_get_measures(arguments: dict) -> dict:
    params = {
        "sort": arguments.get("sort"),
    }
    return await bdl_client.request("/measures", params, arguments.get("lang"))


async def handle_get_measure_by_id(arguments: dict) -> dict:
    measure_id = arguments["id"]
    return await bdl_client.request(f"/measures/{measure_id}", lang=arguments.get("lang"))


async def handle_get_subjects(arguments: dict) -> dict:
    params = {
        "parent-id": arguments.get("parent_id"),
        "page": arguments.get("page"),
        "page-size": arguments.get("page_size"),
        "sort": arguments.get("sort"),
    }
    return await bdl_client.request("/subjects", params, arguments.get("lang"))


async def handle_get_subject_by_id(arguments: dict) -> dict:
    subject_id = arguments["id"]
    return await bdl_client.request(f"/subjects/{subject_id}", lang=arguments.get("lang"))


async def handle_get_units(arguments: dict) -> dict:
    params = {
        "parent-id": arguments.get("parent_id"),
        "level": arguments.get("level"),
        "name": arguments.get("name"),
        "year": arguments.get("year"),
        "kind": arguments.get("kind"),
        "page": arguments.get("page"),
        "page-size": arguments.get("page_size"),
        "sort": arguments.get("sort"),
    }
    return await bdl_client.request("/units", params, arguments.get("lang"))


async def handle_get_unit_by_id(arguments: dict) -> dict:
    unit_id = arguments["id"]
    return await bdl_client.request(f"/units/{unit_id}", lang=arguments.get("lang"))


async def handle_search_units(arguments: dict) -> dict:
    params = {
        "name": arguments["name"],
        "level": arguments.get("level"),
        "year": arguments.get("year"),
        "page": arguments.get("page"),
        "page-size": arguments.get("page_size"),
    }
    return await bdl_client.request("/units/search", params, arguments.get("lang"))


async def handle_get_localities(arguments: dict) -> dict:
    params = {
        "parent-id": arguments["parent_id"],
        "page": arguments.get("page"),
        "page-size": arguments.get("page_size"),
    }
    return await bdl_client.request("/units/localities", params, arguments.get("lang"))


async def handle_get_variables(arguments: dict) -> dict:
    params = {
        "subject-id": arguments.get("subject_id"),
        "level": arguments.get("level"),
        "year": arguments.get("year"),
        "page": arguments.get("page"),
        "page-size": arguments.get("page_size"),
        "sort": arguments.get("sort"),
    }
    return await bdl_client.request("/variables", params, arguments.get("lang"))


async def handle_get_variable_by_id(arguments: dict) -> dict:
    var_id = arguments["id"]
    return await bdl_client.request(f"/variables/{var_id}", lang=arguments.get("lang"))


async def handle_search_variables(arguments: dict) -> dict:
    params = {
        "subject-id": arguments.get("subject_id"),
        "name": arguments.get("name"),
        "level": arguments.get("level"),
        "year": arguments.get("year"),
        "page": arguments.get("page"),
        "page-size": arguments.get("page_size"),
        "sort": arguments.get("sort"),
    }
    return await bdl_client.request("/variables/search", params, arguments.get("lang"))


async def handle_get_years(arguments: dict) -> dict:
    params = {
        "sort": arguments.get("sort"),
    }
    return await bdl_client.request("/years", params, arguments.get("lang"))


async def handle_get_year_by_id(arguments: dict) -> dict:
    year_id = arguments["id"]
    return await bdl_client.request(f"/years/{year_id}", lang=arguments.get("lang"))


# Tool handler mapping
TOOL_HANDLERS = {
    "get_aggregates": handle_get_aggregates,
    "get_aggregate_by_id": handle_get_aggregate_by_id,
    "get_attributes": handle_get_attributes,
    "get_attribute_by_id": handle_get_attribute_by_id,
    "get_data_by_variable": handle_get_data_by_variable,
    "get_data_by_unit": handle_get_data_by_unit,
    "get_data_localities_by_unit": handle_get_data_localities_by_unit,
    "get_levels": handle_get_levels,
    "get_level_by_id": handle_get_level_by_id,
    "get_measures": handle_get_measures,
    "get_measure_by_id": handle_get_measure_by_id,
    "get_subjects": handle_get_subjects,
    "get_subject_by_id": handle_get_subject_by_id,
    "get_units": handle_get_units,
    "get_unit_by_id": handle_get_unit_by_id,
    "search_units": handle_search_units,
    "get_localities": handle_get_localities,
    "get_variables": handle_get_variables,
    "get_variable_by_id": handle_get_variable_by_id,
    "search_variables": handle_search_variables,
    "get_years": handle_get_years,
    "get_year_by_id": handle_get_year_by_id,
}


# ============================================================================
# MCP Server Handlers
# ============================================================================

@server.list_tools()
async def list_tools() -> list[Tool]:
    """List available tools"""
    return TOOLS


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """Handle tool calls"""
    if name not in TOOL_HANDLERS:
        return [TextContent(
            type="text",
            text=json.dumps({"error": f"Unknown tool: {name}"}, ensure_ascii=False)
        )]
    
    try:
        handler = TOOL_HANDLERS[name]
        result = await handler(arguments)
        return [TextContent(
            type="text",
            text=json.dumps(result, ensure_ascii=False, indent=2)
        )]
    except Exception as e:
        logger.error(f"Error calling tool {name}: {e}")
        return [TextContent(
            type="text",
            text=json.dumps({"error": str(e)}, ensure_ascii=False)
        )]


# ============================================================================
# Main Entry Point
# ============================================================================

async def main():
    """Run the MCP server"""
    logger.info("Starting BDL MCP Server...")
    
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options()
        )


if __name__ == "__main__":
    asyncio.run(main())

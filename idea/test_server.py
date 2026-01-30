#!/usr/bin/env python3
"""
Test script for BDL MCP Server

This script tests the basic functionality of the BDL MCP server
by calling various API endpoints.

Run this script from the bdl-mcp-server directory:
    python test_server.py
"""

import asyncio
import json
import sys


async def run_tests():
    """Run tests against the BDL API"""
    
    # Import the server module
    try:
        from server import bdl_client, TOOL_HANDLERS
    except ImportError:
        print("Error: Cannot import server module. Run from bdl-mcp-server directory.")
        sys.exit(1)
    
    print("=" * 60)
    print("BDL MCP Server - Test Suite")
    print("=" * 60)
    
    tests = [
        ("get_years", {}, "Lista lat"),
        ("get_aggregates", {}, "Lista poziomów agregacji"),
        ("get_levels", {}, "Lista poziomów jednostek"),
        ("get_subjects", {"page_size": 5}, "Lista tematów (5 pierwszych)"),
        ("get_units", {"level": 2, "page_size": 5}, "Lista województw (5 pierwszych)"),
        ("search_units", {"name": "Warszawa"}, "Wyszukiwanie: Warszawa"),
        ("get_variables", {"page_size": 3}, "Lista zmiennych (3 pierwsze)"),
    ]
    
    passed = 0
    failed = 0
    
    for tool_name, args, description in tests:
        print(f"\n[TEST] {description}")
        print(f"       Tool: {tool_name}")
        print(f"       Args: {args}")
        
        try:
            handler = TOOL_HANDLERS.get(tool_name)
            if handler:
                result = await handler(args)
                
                if "error" in result:
                    print(f"       ❌ FAILED: {result['error']}")
                    failed += 1
                else:
                    # Check for results
                    if "results" in result:
                        count = len(result.get("results", []))
                        total = result.get("totalRecords", "?")
                        print(f"       ✅ PASSED: Received {count} results (total: {total})")
                        passed += 1
                    else:
                        print(f"       ✅ PASSED: {json.dumps(result, ensure_ascii=False)[:100]}...")
                        passed += 1
            else:
                print(f"       ❌ FAILED: Handler not found")
                failed += 1
                
        except Exception as e:
            print(f"       ❌ FAILED: {str(e)}")
            failed += 1
    
    # Summary
    print("\n" + "=" * 60)
    print(f"Test Summary: {passed} passed, {failed} failed")
    print("=" * 60)
    
    # Close the client
    await bdl_client.close()
    
    return failed == 0


async def test_single_tool(tool_name: str, args: dict):
    """Test a single tool with given arguments"""
    from server import bdl_client, TOOL_HANDLERS
    
    handler = TOOL_HANDLERS.get(tool_name)
    if not handler:
        print(f"Unknown tool: {tool_name}")
        return
    
    print(f"Testing {tool_name} with args: {args}")
    result = await handler(args)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    
    await bdl_client.close()


if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Test specific tool
        tool_name = sys.argv[1]
        args = {}
        if len(sys.argv) > 2:
            try:
                args = json.loads(sys.argv[2])
            except json.JSONDecodeError:
                print("Invalid JSON arguments")
                sys.exit(1)
        asyncio.run(test_single_tool(tool_name, args))
    else:
        # Run all tests
        success = asyncio.run(run_tests())
        sys.exit(0 if success else 1)

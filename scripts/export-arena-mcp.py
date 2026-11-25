"""Call the real Blender MCP server to generate the arena asset."""
import asyncio
from pathlib import Path
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
async def main():
    async with stdio_client(StdioServerParameters(command='uvx',args=['mcp-for-blender'])) as (read,write):
        async with ClientSession(read,write) as session:
            await session.initialize()
            result=await session.call_tool('execute_blender_code',{'code':'ARENA_PROJECT_ROOT = ' + repr(str(Path.cwd())) + '\n' + Path('scripts/build-arena.py').read_text(),'user_prompt':'Build the original Motion Arena architecture and export GLB.'})
            for c in result.content:
                if hasattr(c,'text'): print(c.text)
            if result.is_error: raise RuntimeError('Blender MCP export failed')
asyncio.run(main())

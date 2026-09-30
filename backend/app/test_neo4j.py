from neo4j import GraphDatabase

# Try different URI formats
URIs = [
    "neo4j+s://af5ffae9.databases.neo4j.io",
    "neo4j://af5ffae9.databases.neo4j.io:7687",
    "bolt://af5ffae9.databases.neo4j.io:7687",
    "neo4j+s://af5ffae9.databases.neo4j.io:7687"
]

USER = "neo4j"
PASSWORD = "1fSLMBc7v4MhGNC-XK-vEgYG5F8VwGawvtBh5CZwpbw"

for uri in URIs:
    print(f"\n[*] Trying: {uri}")
    try:
        driver = GraphDatabase.driver(uri, auth=(USER, PASSWORD))
        with driver.session() as session:
            result = session.run("RETURN 'Success!' AS test")
            print(f"[✅] SUCCESS with {uri}: {result.single()['test']}")
        driver.close()
        break
    except Exception as e:
        print(f"[❌] Failed: {str(e)[:100]}")
"""Rebuild the graph by syncing current MongoDB posts into PostgreSQL."""
from graph_builder import build_knowledge_graph

if __name__ == "__main__":
    build_knowledge_graph()
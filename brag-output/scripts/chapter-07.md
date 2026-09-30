# Chapter 07 — Network Intelligence
**Target:** 1:00

| Time | Visual / component | On-screen text | Voiceover |
|---|---|---|---|
| 0:00–0:08 | Open Network Intelligence; establish three panels. | NETWORK INTELLIGENCE · GRAPH METRICS | Network Intelligence summarizes connections in Neo4j. It shows ranked nodes, possible connectors and a chart of node types. |
| 0:08–0:23 | Animate Top Influencers rows; zoom Degree Centrality and Connections. | TOP INFLUENCERS · DEGREE = NUMBER OF CONNECTIONS | Top Influencers are the five nodes with the highest relationship degree in this query. Degree is the number of direct connections a node has. Highly connected nodes are useful starting points for deciding what to inspect next. |
| 0:23–0:39 | Highlight Bridge Nodes and score; illustrate neighboring types. | BRIDGE NODES · DISTINCT NEIGHBOR LABEL PAIRS | Bridge score counts distinct pairs of neighboring node types around a node. If too few results qualify, the endpoint fills the list with high-degree nodes from different labels. This can surface cross-type connectors, but it is not a formal betweenness score. |
| 0:39–0:53 | Animate Community Clusters bars and reveal node-type labels. | COMMUNITY CLUSTERS · NODE COUNTS BY LABEL | The chart labeled Community Clusters counts nodes by their Neo4j label, such as Post, Platform or Narrative. It shows graph composition; it does not calculate social communities. |
| 0:53–1:00 | Close on three panels; transition to graph view. | RANK · CONNECTOR CANDIDATES · NODE TYPES | These views help prioritize graph inspection. Next, we’ll look at the relationships themselves. |

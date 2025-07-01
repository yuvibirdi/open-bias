
import { db, articles, articleGroups, type Article } from "@open-bias/db";
import { isNull, inArray } from "drizzle-orm";
import { TfIdf } from "natural";

const SIMILARITY_THRESHOLD = 0.7; // Adjusted for better grouping; requires tuning.

/**
 * Helper for graph traversal (DFS) to find connected components.
 * @param nodeId The starting article ID.
 * @param adj The adjacency list representing the similarity graph.
 * @param visited A set of visited article IDs.
 * @param component The array to store the current group/component.
 */
function dfs(
    nodeId: number,
    adj: Map<number, number[]>,
    visited: Set<number>,
    component: number[]
) {
    visited.add(nodeId);
    component.push(nodeId);
    const neighbors = adj.get(nodeId) || [];
    for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
            dfs(neighbor, adj, visited, component);
        }
    }
}

export async function groupArticles() {
    // 1. Get all articles that are not yet grouped.
    const ungroupedArticles = await db
        .select()
        .from(articles)
        .where(isNull(articles.groupId));

    if (ungroupedArticles.length < 2) {
        console.log("Not enough articles to form groups.");
        return;
    }

    console.log(`Found ${ungroupedArticles.length} ungrouped articles to process.`);

    const articlesWithSummary = ungroupedArticles.filter(a => a.summary && a.summary.length > 50);
    if (articlesWithSummary.length < 2) {
        console.log("Not enough articles with summaries to form groups.");
        return;
    }

    const tfidf = new TfIdf();
    const docIndexToArticle: Article[] = [];

    // 2. Build a single TF-IDF corpus.
    for (const article of articlesWithSummary) {
        tfidf.addDocument(article.summary!);
        docIndexToArticle.push(article);
    }

    // 3. Build similarity graph (adjacency list).
    const adj = new Map<number, number[]>();
    for (const article of articlesWithSummary) {
        adj.set(article.id, []);
    }

    for (let i = 0; i < docIndexToArticle.length; i++) {
        const article1 = docIndexToArticle[i];
        for (let j = i + 1; j < docIndexToArticle.length; j++) {
            const article2 = docIndexToArticle[j];

            const similarity1to2 = tfidf.tfidf(article1.summary!, j);
            const similarity2to1 = tfidf.tfidf(article2.summary!, i);
            const similarity = (similarity1to2 + similarity2to1) / 2;

            if (similarity > SIMILARITY_THRESHOLD) {
                adj.get(article1.id)!.push(article2.id);
                adj.get(article2.id)!.push(article1.id);
            }
        }
    }

    // 4. Find connected components (these are the groups).
    const visited = new Set<number>();
    const groups: number[][] = [];
    for (const article of articlesWithSummary) {
        if (!visited.has(article.id)) {
            const component: number[] = [];
            dfs(article.id, adj, visited, component);
            if (component.length > 1) {
                groups.push(component);
            }
        }
    }

    if (groups.length === 0) {
        console.log("No new article groups found.");
        return;
    }

    console.log(`Found ${groups.length} new article groups.`);

    // 5. Create group records in DB and update articles.
    for (const articleIdsInGroup of groups) {
        const articlesInGroup = articleIdsInGroup.map(id => articlesWithSummary.find(a => a.id === id)!);
        const masterArticle = articlesInGroup.reduce((prev, current) => ((prev.summary?.length ?? 0) > (current.summary?.length ?? 0)) ? prev : current);

        const [newGroup] = await db.insert(articleGroups).values({
            name: masterArticle.title,
            masterArticleId: masterArticle.id,
        });

        await db
            .update(articles)
            .set({ groupId: newGroup.insertId })
            .where(inArray(articles.id, articleIdsInGroup));
        
        console.log(`Created group "${masterArticle.title}" with ${articleIdsInGroup.length} articles.`);
    }
}

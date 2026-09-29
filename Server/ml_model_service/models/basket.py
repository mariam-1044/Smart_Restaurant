"""Market basket analysis (research §3): mlxtend Apriori + association rules."""

from typing import List, Optional, Tuple

import pandas as pd

from ..data import repository


SPARSE_THRESHOLD = 50


def compute_basket_rules(
    min_support: float = 0.10,
    min_confidence: float = 0.50,
    top_k: int = 20,
    *,
    orders: Optional[List[List[str]]] = None,
) -> Tuple[List[dict], Optional[str]]:
    """Returns (rules, reason).

    `rules` is a list of dicts with antecedent, consequent, support, confidence, lift.
    `reason` is None on success, 'corpus_too_sparse' when len(orders) < SPARSE_THRESHOLD.
    `orders` is injectable for tests.
    """
    if orders is None:
        orders = repository.get_orders_for_basket(min_items=2)

    if len(orders) < SPARSE_THRESHOLD:
        return [], "corpus_too_sparse"

    from mlxtend.frequent_patterns import apriori, association_rules
    from mlxtend.preprocessing import TransactionEncoder

    encoder = TransactionEncoder()
    encoded = encoder.fit_transform(orders)
    df = pd.DataFrame(encoded, columns=encoder.columns_)

    itemsets = apriori(df, min_support=min_support, use_colnames=True)
    if itemsets.empty:
        return [], "corpus_too_sparse"

    rules_df = association_rules(itemsets, metric="confidence", min_threshold=min_confidence)
    if rules_df.empty:
        return [], "corpus_too_sparse"

    rules_df = rules_df.sort_values(by="lift", ascending=False).head(top_k)

    rules: List[dict] = []
    for _, r in rules_df.iterrows():
        rules.append({
            "antecedent": list(r["antecedents"]),
            "consequent": list(r["consequents"]),
            "support": float(r["support"]),
            "confidence": float(r["confidence"]),
            "lift": float(r["lift"]),
        })
    return rules, None

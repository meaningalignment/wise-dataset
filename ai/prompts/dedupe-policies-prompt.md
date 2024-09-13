# Deduplicate Attention Policies

You are given a set of attention policies and a list of other canonical policies. Determine if the policies in the input set are already represented by one of the canonical sets. If so, return the index of the canonical set that represents the shared "source of meaning".

### Sources of meaning

A source of meaning is a set of attention policies that fit together into a way of living that is important to someone when choosing a certain thing. Something where just attending to what is in the policies and making good choices based on them is itself how they want to live.

A source of meaning doesn't contain policies for everything someone attends to when they make the given kind of choice - it contains just the policies they find meaningful to attend to.

### Attention Policies

Attention policies list what a person pays attention to when they do a kind of choice. Each attention policy centers on something precise that can be attended to, not a vague concept.

# Guidelines
Two or more sets of policies are about the same source of meaning if:
- A user that articulated one of the sets would feel like the other sets in the cluster capture what they cared about *fully*.
- Someone instructed to pay attention to one set of policies would in practice pay attention to the same things as someone instructed to pay attention to the other set.
- Someone asked to design an experience that seeks to enable the policies in one set would end up with something that is also serving the policies of the other set.
- Any difference in policies between the sets would be acknowledged as an oversight or a mistake, and both sets should be updated to reflect the same policies.
- The sets are formulated using roughly the same level of granularity and detail.

*Only if two or more sets pass all of these criteria can they be considered to be about the same source of meaning.*
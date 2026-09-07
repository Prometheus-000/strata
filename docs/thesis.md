# Thesis

A design system used to be a library: a stylesheet somebody hand-tuned, a
component set somebody maintained, and a review gate that turned "no" into a
process. It gave nothing back to the designer, it belonged to one platform,
and it assumed the only author was a human with a text box.

Three things broke that model at once. Agents started writing UI, and an
agent with a component list generates collage while an agent with reasons
generates coherent work — which is the founding claim, and `bench/` is where
it is put to a test rather than repeated. The runs so far give it a form
narrower than the sentence, and are written up there. Products started needing more than one projection
of the same intent — React, CSS, Figma, a runtime the team has not chosen
yet. And the review gate turned out to measure the wrong moment: a design in
progress fails any check by definition, so a tool that reports mid-drag
reads as policing by volume, and nobody designs from inside a system that is
waiting for them to comply.

Strata's answer is to make the decision the primitive. Not the token, not
the component, not the theme — the decision: what changed, who changed it,
why, and what followed. One record holds every one of them. Every file a
build produces is derived from it and can be produced again. Every hand
goes through the same call. And nothing in it can fail a build except a
mechanical truth about the artifact: the record parses, the projections
match it, every fallback chain ends, every `var()` resolves. A design that
is different is reported, never refused.

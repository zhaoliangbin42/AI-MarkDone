---
name: brainstorming
description: "Use before any feature design or requirement exploration - guides conversation to understand user intent through one question at a time, multiple choice when possible, and incremental design validation."
---

# Brainstorming: Conversation Techniques

## Purpose

Guide users through requirement exploration and design decisions using structured dialogue techniques. This skill focuses on **how to have effective conversations**, not on generating plans (which Antigravity's `implementation_plan.md` handles).

## When to Use

- User has a vague idea that needs refinement
- Requirement exploration before implementation planning
- Design decision discussions with trade-offs

## Core Techniques

### Technique 1: One Question at a Time

❌ **Don't do this:**
```
Please tell me:
1. What is the feature scope?
2. Who are the target users?
3. What constraints exist?
4. What's the timeline?
```

✅ **Do this:**
```
First, let me understand the core goal.
What problem does this feature solve for users?
```

### Technique 2: Multiple Choice Preferred

When exploring options, provide structured choices:

```
For the bookmark panel layout, which approach do you prefer?

A) Grid layout - compact, shows more items
B) List layout - more details visible per item  
C) Hybrid - grid by default, list for search results

I recommend (A) for this use case because...
```

### Technique 3: Incremental Validation

Present design in 200-300 word sections, validate each before continuing:

```
Here's the first part of the design:

[Architecture overview - 250 words]

Does this direction look right so far? 
Any concerns before I continue to the data flow section?
```

### Technique 4: Explore Alternatives

Always propose 2-3 approaches before settling:

```
I see two main approaches:

**Approach A: Client-side filtering**
- Pros: Fast, no network latency
- Cons: Memory usage for large datasets

**Approach B: Server-side filtering** 
- Pros: Scalable, consistent
- Cons: Requires API changes

I recommend Approach A for this feature because [reason].
What do you think?
```

## After Brainstorming

Once design is understood, Antigravity will generate `implementation_plan.md` for user review. This skill's job ends when the design direction is clear.

## Key Principles

| Principle | Description |
|:----------|:------------|
| **One question** | Never overwhelm with multiple questions |
| **Multiple choice** | Easier to answer than open-ended |
| **YAGNI** | Remove unnecessary features ruthlessly |
| **Explore alternatives** | Always show 2-3 options |
| **Incremental validation** | Present in sections, validate each |

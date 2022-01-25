# Voting and Delegation

## 1 Abstract

This document elaborates the logic behind the voting power distribution and delegation implemented in the TelediskoDAO contracts.

## 2 Motivation

One of the main components of the TelediskoDAO is the automatic voting and settlement of resolutions. The Article of Association of the DAO describes how the voting process for a resolution should be implemented. More in detail:

* it specifies on how the voting power should be distributed among token holders
* it specifies how the delegation among contributors should work

It boils down to set of rules governing the voting and delegation process. Such rules need to be implemented via a Smart Contract in order to enable to automatic execution of this part of the DAO. 
## 3 Specification
### 3.1 Rules
AoA rules:
* Only Contributors can vote.
* A Contributor's voting power equals the amount of TT tokens it owns.
* A Contributor A can delegate another Contributor B, thus transferring A's voting power to B.
* A Contributor A cannot delegate another Contributor B if B already delegated someone else.
* A Contributor A cannot delegate another Contributor if A itself has already been delegated.
* When a Contributor receives new tokens from any source, its voting power increases by the transferred amount.
* The total voting power at a given time in the DAO is the sum of the voting power of the individual Contributors.

Additional rules:
* A Contributor must first delegate itself to be able to delegate others

### 3.2 Voting.sol
The voting power of an account changes after the following actions:
* Delegation
* Token transfer
* Removal of Contributor status

#### 3.2.2 Delegation use cases
Preconditions: 
* Both A and B are Contributors
* A has a delegate C (who is also a Contributor)
* B has delegated itself

Flow:
1. A delegates B
2. The balance of A is added as voting power to B.
3. The balance of A is also removed from the voting power of C.
---
Preconditions:
* Both A and B are Contributors
* A has delegated itself
* B has delegated itself

Flow:
1. A delegates B, 
2. The balance of A is added as voting power to B.
3. The balance of A is also removed from the voting power of A.
---
Preconditions:
* A is a Contributor
* A has no delegate

1. A delegates A
2. THe balance of A is added as voting power to A
---
In all the following cases, delegation fails:
* A is delegating B, but A has currently no delegates
* A is delegating B, but B already has a delegate
* A is delegating B, but A already has a delegator
* A is delegating B, but B is not a contributor
* A is delegating B, but A is not a contributor
#### 3.2.1 Token transfer
## 4 Rationale

<!-- The rationale fleshes out the specification by describing what motivated
the design and why particular design decisions were made. It should describe
alternate designs that were considered and related work, e.g. how the feature
is supported in other languages. The rationale may also provide evidence of
consensus within the community, and should discuss important objections or
concerns raised during discussion.-->

## 5 Implementation

<!--The implementations must be completed before any TIP is given status
"stable", but it need not be completed before the TIP is accepted. While there
is merit to the approach of reaching consensus on the TIP and rationale before
writing code, the principle of "rough consensus and running code" is still
useful when it comes to resolving many discussions of API details.-->

## 6 Copyright

<!--All TIPs MUST be released to the public domain.-->

Copyright and related rights waived via
[CC0](https://creativecommons.org/publicdomain/zero/1.0/)
-- Normalize Strategy Names Migration
-- Updates strategy_name values from display names to internal type names
-- This ensures consistency between database queries and API expectations

-- Update existing strategy_decisions records to use simplified names
UPDATE strategy_decisions
SET strategy_name = 'balanced'
WHERE strategy_name = 'Complexity-Based';

UPDATE strategy_decisions
SET strategy_name = 'speed'
WHERE strategy_name = 'Speed First';

UPDATE strategy_decisions
SET strategy_name = 'quality'
WHERE strategy_name = 'Quality First';

UPDATE strategy_decisions
SET strategy_name = 'cost'
WHERE strategy_name = 'Cost Optimized';

UPDATE strategy_decisions
SET strategy_name = 'adaptive'
WHERE strategy_name = 'Adaptive ML';

UPDATE strategy_decisions
SET strategy_name = 'workflow'
WHERE strategy_name = 'Workflow';

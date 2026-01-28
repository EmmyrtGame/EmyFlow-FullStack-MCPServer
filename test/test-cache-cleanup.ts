/**
 * Test: Cache Cleanup Verification
 * 
 * Verifies that in-memory caches are properly cleaned up after TTL expires.
 * Uses a shorter TTL for testing purposes.
 * 
 * Run: npx ts-node test/test-cache-cleanup.ts
 */

// Simulate the cache behavior with shorter TTLs for testing
const LEAD_CACHE_TTL_MS = 3000; // 3 seconds for testing (real: 5 minutes)
const HUMAN_HANDOFF_TIMEOUT_MS = 5000; // 5 seconds for testing (real: 30 minutes)

const leadSentCache: Record<string, number> = {};
const humanHandoffState: Record<string, number> = {};

const cleanupAllCaches = () => {
    const now = Date.now();
    let leadsCleaned = 0;
    let handoffsCleaned = 0;

    // Cleanup leadSentCache
    for (const key in leadSentCache) {
        if (now - leadSentCache[key] > LEAD_CACHE_TTL_MS) {
            delete leadSentCache[key];
            leadsCleaned++;
        }
    }

    // Cleanup humanHandoffState
    for (const key in humanHandoffState) {
        if (now - humanHandoffState[key] > HUMAN_HANDOFF_TIMEOUT_MS) {
            delete humanHandoffState[key];
            handoffsCleaned++;
        }
    }

    return { leadsCleaned, handoffsCleaned };
};

async function testCacheCleanup() {
    console.log('='.repeat(60));
    console.log('🧹 TEST: Cache Cleanup Verification');
    console.log('='.repeat(60));
    console.log('');

    // Test 1: Add entries to both caches
    console.log('📦 Adding test entries to caches...');
    leadSentCache['client1:5551234567'] = Date.now();
    leadSentCache['client1:5559876543'] = Date.now();
    leadSentCache['client2:5551111111'] = Date.now();
    humanHandoffState['5551234567@c.us'] = Date.now();
    humanHandoffState['5559999999@c.us'] = Date.now();

    console.log(`   Lead cache entries: ${Object.keys(leadSentCache).length}`);
    console.log(`   Handoff cache entries: ${Object.keys(humanHandoffState).length}`);

    // Test 2: Cleanup immediately (should NOT remove anything)
    console.log('\n🔍 Running cleanup immediately (should remove 0)...');
    let result = cleanupAllCaches();
    console.log(`   Leads cleaned: ${result.leadsCleaned}`);
    console.log(`   Handoffs cleaned: ${result.handoffsCleaned}`);
    console.log(`   Lead cache remaining: ${Object.keys(leadSentCache).length}`);
    console.log(`   Handoff cache remaining: ${Object.keys(humanHandoffState).length}`);

    if (result.leadsCleaned !== 0 || result.handoffsCleaned !== 0) {
        console.log('\n❌ FAIL: Entries were cleaned before TTL expired!');
        process.exit(1);
    }
    console.log('   ✓ Correct: No entries removed before TTL');

    // Test 3: Wait for lead cache TTL to expire (3 seconds)
    console.log(`\n⏳ Waiting ${LEAD_CACHE_TTL_MS / 1000}s for lead cache TTL...`);
    await new Promise(r => setTimeout(r, LEAD_CACHE_TTL_MS + 100));

    console.log('🔍 Running cleanup after lead TTL expired...');
    result = cleanupAllCaches();
    console.log(`   Leads cleaned: ${result.leadsCleaned}`);
    console.log(`   Handoffs cleaned: ${result.handoffsCleaned}`);
    console.log(`   Lead cache remaining: ${Object.keys(leadSentCache).length}`);
    console.log(`   Handoff cache remaining: ${Object.keys(humanHandoffState).length}`);

    if (result.leadsCleaned !== 3) {
        console.log('\n❌ FAIL: Expected 3 leads to be cleaned!');
        process.exit(1);
    }
    if (result.handoffsCleaned !== 0) {
        console.log('\n❌ FAIL: Handoffs should NOT be cleaned yet!');
        process.exit(1);
    }
    console.log('   ✓ Correct: Lead cache cleaned, handoff cache intact');

    // Test 4: Wait for handoff cache TTL to expire
    const remainingWait = HUMAN_HANDOFF_TIMEOUT_MS - LEAD_CACHE_TTL_MS;
    console.log(`\n⏳ Waiting ${remainingWait / 1000}s more for handoff cache TTL...`);
    await new Promise(r => setTimeout(r, remainingWait + 100));

    console.log('🔍 Running cleanup after handoff TTL expired...');
    result = cleanupAllCaches();
    console.log(`   Leads cleaned: ${result.leadsCleaned}`);
    console.log(`   Handoffs cleaned: ${result.handoffsCleaned}`);
    console.log(`   Lead cache remaining: ${Object.keys(leadSentCache).length}`);
    console.log(`   Handoff cache remaining: ${Object.keys(humanHandoffState).length}`);

    if (result.handoffsCleaned !== 2) {
        console.log('\n❌ FAIL: Expected 2 handoffs to be cleaned!');
        process.exit(1);
    }
    console.log('   ✓ Correct: Handoff cache cleaned');

    // Test 5: Verify caches are empty
    console.log('\n🔍 Verifying caches are empty...');
    if (Object.keys(leadSentCache).length !== 0 || Object.keys(humanHandoffState).length !== 0) {
        console.log('\n❌ FAIL: Caches should be empty!');
        process.exit(1);
    }
    console.log('   ✓ Correct: All caches are empty');

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ ALL CACHE CLEANUP TESTS PASSED');
    console.log('='.repeat(60));
}

testCacheCleanup().catch(console.error);

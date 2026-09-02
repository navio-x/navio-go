<template>
  <div class="bg-gray-50 dark:bg-gh-900 min-h-full flex flex-col"
       @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd">

    <!-- Testnet warning banner: kalıcı ve göz alıcı -->
    <div v-if="network?.isTestnet" class="sticky top-0 z-20 bg-yellow-400 dark:bg-yellow-500 text-black text-xs font-bold text-center py-1.5 px-2 tracking-wide">
      {{ $t('dex.testnetWarning') }}
    </div>

    <div class="p-5 pb-6 space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ $t('dex.title') }}</h1>
        <button
          @click="handleRefresh"
          :disabled="refreshing"
          class="p-2 rounded-full transition-colors text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gh-700 disabled:opacity-50"
          :aria-label="$t('dex.refresh')"
        >
          <RefreshCw class="w-5 h-5" :class="{ 'animate-spin': refreshing }" />
        </button>
      </div>

      <div v-if="pullDistance > 0 && !refreshing" class="flex justify-center" :style="{ opacity: Math.min(pullDistance / 70, 1) }">
        <RefreshCw class="w-5 h-5 text-gray-400" :class="{ 'animate-spin': pullDistance > 70 }" />
      </div>

      <!-- Derivation error -->
      <div v-if="derivationError" class="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4 flex gap-3">
        <AlertTriangle class="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <p class="text-sm text-red-700 dark:text-red-300 leading-snug">{{ derivationError }}</p>
      </div>

      <template v-else>
        <!-- Account card -->
        <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-5 flex flex-col items-center gap-4">
          <div v-if="evmAddress" class="p-3 bg-white rounded-xl ring-1 ring-gray-100 dark:ring-gh-700">
            <QRCode :value="evmAddress" :size="140" />
          </div>
          <div v-else class="h-[164px] w-[164px] bg-gray-100 dark:bg-gh-700 rounded-xl animate-pulse" />

          <div class="w-full bg-gray-50 dark:bg-gh-700 rounded-xl px-4 py-3">
            <p class="font-mono text-xs text-gray-700 dark:text-gray-300 break-all text-center leading-relaxed select-all">
              {{ evmAddress || $t('dex.deriving') }}
            </p>
          </div>

          <button
            @click="copyAddress"
            :disabled="!evmAddress"
            class="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
            :class="copied ? 'bg-green-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'"
          >
            <Check v-if="copied" class="w-4 h-4" />
            <Copy v-else class="w-4 h-4" />
            {{ copied ? $t('common.copied') : $t('common.copy') }}
          </button>

          <div class="w-full grid grid-cols-2 gap-2 text-xs">
            <div class="bg-gray-50 dark:bg-gh-700 rounded-xl px-3 py-2">
              <p class="text-gray-400 dark:text-gray-500">{{ $t('dex.network') }}</p>
              <p class="font-medium text-gray-800 dark:text-gray-100 truncate">
                {{ network?.name }} ({{ network?.chainId }})
              </p>
            </div>
            <div class="bg-gray-50 dark:bg-gh-700 rounded-xl px-3 py-2">
              <p class="text-gray-400 dark:text-gray-500">{{ $t('dex.rpcStatus') }}</p>
              <p
                class="font-medium flex items-center gap-1"
                :class="evmStatus === 'error' ? 'text-red-500' : 'text-green-600 dark:text-green-400'"
              >
                <Wifi v-if="evmStatus !== 'error'" class="w-3.5 h-3.5 shrink-0" />
                <WifiOff v-else class="w-3.5 h-3.5 shrink-0" />
                <span class="truncate">{{ evmStatus === 'error' ? $t('dex.rpcError') : $t('dex.rpcConnected') }}</span>
              </p>
            </div>
          </div>

          <a
            v-if="explorerUrl"
            :href="explorerUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors
                   border border-gray-200 dark:border-gh-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gh-700"
          >
            <ExternalLink class="w-4 h-4" />
            {{ $t('dex.viewExplorer') }}
          </a>
        </div>

        <!-- Stale data badge -->
        <div
          v-if="rpcStale"
          class="rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 px-4 py-2.5 text-xs text-yellow-800 dark:text-yellow-300 font-medium"
        >
          {{ $t('dex.staleWarning') }}
        </div>

        <!-- Swap card -->
        <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-5 space-y-3">
          <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400">{{ $t('dex.swap.title') }}</h2>

          <!-- From -->
          <div class="rounded-xl bg-gray-50 dark:bg-gh-700 p-3 space-y-2">
            <div class="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
              <span>{{ $t('dex.swap.from') }}</span>
              <span>
                {{ $t('dex.swap.balance') }}: {{ fromBalanceDisplay }}
                <button @click="setMaxAmount" :disabled="isBusy" class="ml-1 font-semibold text-blue-600 dark:text-blue-400">
                  {{ $t('dex.swap.max') }}
                </button>
              </span>
            </div>
            <div class="flex items-center gap-2">
              <select
                v-model="fromAssetKey"
                :disabled="isBusy"
                class="shrink-0 max-w-[40%] px-2 py-2 rounded-lg text-sm font-medium bg-white dark:bg-gh-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gh-600 outline-none"
              >
                <option v-for="opt in assetOptions" :key="opt.key" :value="opt.key">{{ opt.symbol }}</option>
              </select>
              <input
                v-model="amountInput"
                type="number"
                min="0"
                step="any"
                placeholder="0.0"
                :disabled="isBusy"
                class="w-full min-w-0 bg-transparent text-right text-lg font-semibold text-gray-900 dark:text-white outline-none"
              />
            </div>
          </div>

          <!-- Flip button -->
          <div class="flex justify-center -my-1 relative z-10">
            <button
              @click="flipAssets"
              :disabled="isBusy"
              class="w-8 h-8 rounded-full bg-white dark:bg-gh-800 border border-gray-200 dark:border-gh-600 flex items-center justify-center shadow-sm"
            >
              <ArrowDownUp class="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          <!-- To -->
          <div class="rounded-xl bg-gray-50 dark:bg-gh-700 p-3 space-y-2">
            <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('dex.swap.to') }}</p>
            <div class="flex items-center gap-2">
              <select
                v-model="toAssetKey"
                :disabled="isBusy"
                class="shrink-0 max-w-[40%] px-2 py-2 rounded-lg text-sm font-medium bg-white dark:bg-gh-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gh-600 outline-none"
              >
                <option v-for="opt in assetOptions" :key="opt.key" :value="opt.key">{{ opt.symbol }}</option>
              </select>
              <p class="w-full text-right text-lg font-semibold text-gray-900 dark:text-white truncate">
                {{ swap.status.value === 'quoting' ? '…' : estimatedOutDisplay }}
              </p>
            </div>
          </div>

          <!-- Quote details -->
          <div v-if="swap.quote.value" class="text-xs space-y-1 pt-1">
            <div class="flex justify-between text-gray-500 dark:text-gray-400">
              <span>{{ $t('dex.swap.path') }}</span>
              <span class="font-medium text-gray-700 dark:text-gray-300">{{ pathSymbolsDisplay }}</span>
            </div>
            <div class="flex justify-between text-gray-500 dark:text-gray-400">
              <span>{{ $t('dex.swap.minReceived') }}</span>
              <span class="font-medium text-gray-700 dark:text-gray-300">{{ minReceivedDisplay }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500 dark:text-gray-400">{{ $t('dex.swap.priceImpact') }}</span>
              <span :class="priceImpactClass">{{ priceImpactDisplay }}</span>
            </div>
          </div>

          <!-- Price impact warning (>5%) -->
          <div
            v-if="priceImpactPct !== null && priceImpactPct > 5"
            class="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-3 py-2.5 text-xs text-red-700 dark:text-red-300"
          >
            {{ $t('dex.swap.priceImpactWarning') }}
          </div>

          <!-- Two-step approval notice -->
          <div
            v-if="swap.needsApproval.value && !isBusy && swap.status.value !== 'success'"
            class="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 px-3 py-2.5 text-xs text-blue-700 dark:text-blue-300"
          >
            {{ $t('dex.swap.twoStepNotice') }}
          </div>

          <!-- Swap error -->
          <div
            v-if="swap.status.value === 'error'"
            class="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-3 py-2.5 text-xs text-red-700 dark:text-red-300"
          >
            {{ $t('dex.swap.errors.' + (swap.errorCode.value || 'unknown')) }}
          </div>

          <!-- Swap success -->
          <div
            v-if="swap.status.value === 'success'"
            class="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 px-3 py-2.5 text-xs text-green-700 dark:text-green-300 space-y-1"
          >
            <p class="font-semibold">{{ $t('dex.swap.success') }}{{ successAmountDisplay ? ` — ${successAmountDisplay}` : '' }}</p>
            <a
              v-if="explorerTxUrl(swap.txHash.value)"
              :href="explorerTxUrl(swap.txHash.value)"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 underline"
            >
              <ExternalLink class="w-3 h-3" />
              {{ $t('dex.swap.viewTx') }}
            </a>
          </div>

          <button
            @click="handleSwapClick"
            :disabled="!canSwap && swap.status.value !== 'success'"
            class="w-full py-3 rounded-xl text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            :class="swap.status.value === 'error' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'"
          >
            <Loader2 v-if="isBusy" class="w-4 h-4 animate-spin" />
            {{ swapButtonLabel }}
          </button>
        </div>

        <!-- High price impact confirm modal -->
        <div v-if="showHighImpactConfirm" class="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div class="bg-white dark:bg-gh-900 border border-gray-100 dark:border-gh-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <div class="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mx-auto">
              <AlertTriangle class="w-6 h-6 text-red-500" />
            </div>
            <div class="text-center space-y-1">
              <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ $t('dex.swap.priceImpactHighConfirmTitle') }}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('dex.swap.priceImpactHighConfirmDesc') }}</p>
            </div>
            <div class="flex gap-2 pt-1">
              <button
                @click="showHighImpactConfirm = false"
                class="flex-1 py-2 rounded-xl text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
              >
                {{ $t('common.cancel') }}
              </button>
              <button
                @click="confirmHighImpact"
                class="flex-1 py-2 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-700 text-white"
              >
                {{ $t('dex.swap.priceImpactHighConfirmProceed') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Balances -->
        <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
          <div class="px-4 py-3 flex items-center justify-between">
            <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400">{{ $t('dex.balances.title') }}</h2>
            <button @click="hideZero = !hideZero" class="text-xs font-medium text-blue-600 dark:text-blue-400">
              {{ hideZero ? $t('dex.balances.showAll') : $t('dex.balances.hideZero') }}
            </button>
          </div>

          <!-- Native balance, always on top -->
          <div class="border-t border-gray-200 dark:border-gh-700 px-4 py-3 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <TokenIcon v-if="nativeAssetInfo" :symbol="nativeAssetInfo.symbol" :logo="nativeAssetInfo.logo" :size="24" />
              <p class="text-sm font-medium text-gray-800 dark:text-gray-100">{{ network?.nativeSymbol }}</p>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <div class="text-right">
                <p class="text-sm font-mono text-gray-700 dark:text-gray-300">
                  {{ nativeBalance ? formatDisplay(nativeBalance.formatted) : '—' }}
                </p>
                <p v-if="nativeBalance && fiatValueDisplay('native', nativeBalance.formatted)" class="text-xs text-gray-400 dark:text-gray-500">
                  {{ fiatValueDisplay('native', nativeBalance.formatted) }}
                </p>
              </div>
              <button
                v-if="nativeAssetInfo"
                @click="openTokenInfo(nativeAssetInfo)"
                :aria-label="$t('dex.tokenInfo.title')"
                class="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gh-700"
              >
                <Info class="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            v-for="token in visibleTokens"
            :key="token.address"
            class="border-t border-gray-200 dark:border-gh-700 px-4 py-3 flex items-center justify-between gap-2"
          >
            <div class="flex items-center gap-2 min-w-0">
              <TokenIcon :symbol="token.symbol" :logo="token.logo" :custom="!!token.custom" :size="28" />
              <div class="min-w-0">
                <p class="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{{ token.symbol }}</p>
                <p class="text-xs text-gray-400 dark:text-gray-500 truncate">{{ token.name }}</p>
              </div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <div class="text-right">
                <p class="text-sm font-mono text-gray-700 dark:text-gray-300">
                  {{ token.balance !== undefined ? formatDisplay(token.formatted) : '—' }}
                </p>
                <p v-if="token.balance !== undefined && fiatValueDisplay(token.address.toLowerCase(), token.formatted)" class="text-xs text-gray-400 dark:text-gray-500">
                  {{ fiatValueDisplay(token.address.toLowerCase(), token.formatted) }}
                </p>
              </div>
              <button
                @click="openTokenInfo(token)"
                :aria-label="$t('dex.tokenInfo.title')"
                class="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gh-700"
              >
                <Info class="w-4 h-4" />
              </button>
            </div>
          </div>

          <p
            v-if="tokenBalanceList.length === 0"
            class="border-t border-gray-200 dark:border-gh-700 px-4 py-4 text-sm text-gray-400 dark:text-gray-500 text-center"
          >
            {{ $t('dex.balances.empty') }}
          </p>
        </div>

        <!-- Add custom token -->
        <button
          @click="openAddToken"
          class="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium transition-colors
                 border border-dashed border-gray-300 dark:border-gh-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gh-800"
        >
          <Plus class="w-4 h-4" />
          {{ $t('dex.addToken.button') }}
        </button>
      </template>
    </div>

    <!-- Token info modal -->
    <div v-if="tokenInfoModal" class="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div class="bg-white dark:bg-gh-900 border border-gray-100 dark:border-gh-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 min-w-0">
            <TokenIcon :symbol="tokenInfoModal.symbol" :logo="tokenInfoModal.logo" :custom="!!tokenInfoModal.custom" :size="28" />
            <h3 class="text-base font-bold text-gray-900 dark:text-white truncate">{{ tokenInfoModal.symbol }}</h3>
          </div>
          <button @click="closeTokenInfo" :aria-label="$t('common.close')">
            <X class="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div class="space-y-3">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
              {{ $t('dex.tokenInfo.name') }}
            </p>
            <p class="text-sm text-gray-800 dark:text-gray-100 font-medium">{{ tokenInfoModal.name || tokenInfoModal.symbol }}</p>
          </div>

          <div v-if="tokenInfoModal.address">
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
              {{ $t('dex.tokenInfo.address') }}
            </p>
            <div class="flex items-center gap-2 bg-gray-50 dark:bg-gh-700 rounded-xl px-3 py-2.5">
              <p class="font-mono text-xs text-gray-700 dark:text-gray-300 break-all flex-1 select-all">
                {{ tokenInfoModal.address }}
              </p>
              <button
                @click="copyTokenAddress"
                :aria-label="$t('common.copy')"
                class="shrink-0 p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gh-600"
              >
                <Check v-if="tokenAddressCopied" class="w-4 h-4 text-green-500" />
                <Copy v-else class="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
          <p v-else class="text-xs text-gray-400 dark:text-gray-500">{{ $t('dex.tokenInfo.nativeNote') }}</p>

          <div class="grid grid-cols-2 gap-2">
            <div class="bg-gray-50 dark:bg-gh-700 rounded-xl px-3 py-2">
              <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('dex.tokenInfo.decimals') }}</p>
              <p class="text-sm font-medium text-gray-800 dark:text-gray-100">{{ tokenInfoModal.decimals }}</p>
            </div>
            <div class="bg-gray-50 dark:bg-gh-700 rounded-xl px-3 py-2">
              <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('dex.tokenInfo.balance') }}</p>
              <p class="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                {{ tokenInfoModal.formatted !== undefined && tokenInfoModal.formatted !== null ? formatDisplay(tokenInfoModal.formatted) : '—' }}
              </p>
              <p v-if="tokenInfoFiatValue" class="text-xs text-gray-400 dark:text-gray-500 truncate">{{ tokenInfoFiatValue }}</p>
            </div>
          </div>

          <div v-if="tokenInfoModal.pinned || tokenInfoModal.custom || tokenInfoModal.feeOnTransfer" class="flex flex-wrap gap-1.5">
            <span v-if="tokenInfoModal.pinned" class="px-2 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300">
              {{ $t('dex.tokenInfo.pinned') }}
            </span>
            <span v-if="tokenInfoModal.custom" class="px-2 py-1 rounded-full text-xs font-medium bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300">
              {{ $t('dex.tokenInfo.custom') }}
            </span>
            <span v-if="tokenInfoModal.feeOnTransfer" class="px-2 py-1 rounded-full text-xs font-medium bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
              {{ $t('dex.tokenInfo.feeOnTransfer') }}
            </span>
          </div>
        </div>

        <a
          v-if="tokenInfoModal.address && network?.explorer"
          :href="`${network.explorer}/token/${tokenInfoModal.address}`"
          target="_blank"
          rel="noopener noreferrer"
          class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors
                 border border-gray-200 dark:border-gh-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gh-700"
        >
          <ExternalLink class="w-4 h-4" />
          {{ $t('dex.viewExplorer') }}
        </a>

        <div v-if="tokenInfoModal.custom">
          <button
            v-if="!confirmRemoveToken"
            @click="confirmRemoveToken = true"
            class="w-full py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400
                   border border-red-200 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            {{ $t('dex.tokenInfo.remove') }}
          </button>
          <div v-else class="flex gap-2">
            <button
              @click="confirmRemoveToken = false"
              class="flex-1 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gh-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gh-700"
            >
              {{ $t('common.cancel') }}
            </button>
            <button
              @click="removeTokenConfirmed"
              class="flex-1 py-2 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-700 text-white"
            >
              {{ $t('dex.tokenInfo.removeConfirm') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add token modal -->
    <div v-if="showAddToken" class="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div class="bg-white dark:bg-gh-900 border border-gray-100 dark:border-gh-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ $t('dex.addToken.title') }}</h3>
          <button @click="closeAddToken" :aria-label="$t('common.close')">
            <X class="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <template v-if="!pendingToken">
          <div>
            <label class="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {{ $t('dex.addToken.addressLabel') }}
            </label>
            <input
              v-model.trim="newTokenAddress"
              type="text"
              :placeholder="$t('dex.addToken.addressPlaceholder')"
              class="w-full rounded-xl px-3 py-2.5 text-sm font-mono outline-none transition-colors
                     bg-gray-50 dark:bg-gh-700 text-gray-900 dark:text-white
                     border border-gray-200 dark:border-gh-600
                     focus:border-blue-400 dark:focus:border-blue-500"
            />
          </div>
          <p v-if="addTokenError" class="text-sm text-red-500">{{ addTokenError }}</p>
          <button
            @click="lookupToken"
            :disabled="addTokenLoading || !newTokenAddress"
            class="w-full py-3 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white flex items-center justify-center gap-2"
          >
            <Loader2 v-if="addTokenLoading" class="w-4 h-4 animate-spin" />
            {{ $t('dex.addToken.lookup') }}
          </button>
        </template>

        <template v-else>
          <div class="rounded-xl bg-gray-50 dark:bg-gh-700 p-3 space-y-1">
            <p class="text-sm font-semibold text-gray-800 dark:text-gray-100">{{ pendingToken.symbol }} — {{ pendingToken.name }}</p>
            <p class="text-xs font-mono text-gray-400 dark:text-gray-500 break-all">{{ pendingToken.address }}</p>
            <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('dex.addToken.decimals') }}: {{ pendingToken.decimals }}</p>
          </div>

          <div class="flex gap-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 rounded-xl p-3">
            <AlertTriangle class="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            <p class="text-xs text-yellow-800 dark:text-yellow-300 leading-snug">{{ $t('dex.addToken.warning') }}</p>
          </div>

          <label class="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
            <input type="checkbox" v-model="pendingTokenFeeOnTransfer" class="mt-0.5" />
            <span>{{ $t('dex.addToken.feeOnTransferLabel') }}</span>
          </label>

          <div class="flex gap-2">
            <button
              @click="pendingToken = null"
              class="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gh-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gh-700"
            >
              {{ $t('common.cancel') }}
            </button>
            <button
              @click="confirmAddToken"
              class="flex-1 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white"
            >
              {{ $t('dex.addToken.confirm') }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { isAddress, getAddress, parseUnits, formatUnits } from 'viem'
import copy from 'copy-to-clipboard'
import QRCode from 'qrcode.vue'
import TokenIcon from '@/components/TokenIcon.vue'
import {
  Copy, Check, ExternalLink, RefreshCw, Wifi, WifiOff, Plus, X, AlertTriangle, Loader2, ArrowDownUp, Info,
} from 'lucide-vue-next'
import { settings } from '@/stores/settings'
import {
  evmAddress, evmStatus, nativeBalance, tokenBalanceList, rpcStale,
  refreshBalances, startBalancePolling, stopBalancePolling, readTokenMetadata,
  getActiveClient,
} from '@/stores/evm'
import { navPrice, startPricePolling, stopPricePolling } from '@/stores/navPrice'
import { deriveEvmAddress } from '@/composables/useEvmAccount'
import { usePancakeSwap } from '@/composables/usePancakeSwap'
import {
  getNetworkConfig, getRouterAddress, getWrappedNative, getBaseTokenAddresses,
} from '@/lib/evm/networkRegistry'
import { addCustomToken, removeCustomToken } from '@/lib/evm/customTokens'
import { quoteTokenUsdPrice } from '@/lib/evm/tokenPricing'

const { t } = useI18n()

const derivationError = ref('')
const copied = ref(false)
const hideZero = ref(false)
const refreshing = ref(false)

const showAddToken = ref(false)
const newTokenAddress = ref('')
const addTokenLoading = ref(false)
const addTokenError = ref('')
const pendingToken = ref(null)
const pendingTokenFeeOnTransfer = ref(false)

const network = computed(() => getNetworkConfig(settings.evmNetwork))

const explorerUrl = computed(() => {
  if (!network.value?.explorer || !evmAddress.value) return null
  return `${network.value.explorer}/address/${evmAddress.value}`
})

// "pinned" yalnızca registry'nin küratörlü/önerilen token'ları olduğunu
// işaretler — "Sıfır bakiyeleri gizle" açıkken bile onları göstermeye devam
// etmek, kullanıcının WBNB/USDT/BUSD/WNAV'ın hepsine sahip olmadığı çoğu
// durumda anahtarı işlevsiz kılıyordu. Filtre artık pinned olsun olmasın
// tüm token'lara aynı şekilde uygulanıyor.
const visibleTokens = computed(() =>
  tokenBalanceList.value.filter((token) => {
    if (!hideZero.value) return true
    return token.balance !== undefined && token.balance > 0n
  })
)

function formatDisplay(formatted) {
  const num = Number(formatted)
  if (!Number.isFinite(num)) return formatted
  return num.toLocaleString(undefined, { maximumFractionDigits: 6 })
}

function copyAddress() {
  if (!evmAddress.value) return
  copy(evmAddress.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

async function handleRefresh() {
  refreshing.value = true
  await refreshBalances()
  refreshing.value = false
}

function openAddToken() {
  newTokenAddress.value = ''
  addTokenError.value = ''
  pendingToken.value = null
  pendingTokenFeeOnTransfer.value = false
  showAddToken.value = true
}

function closeAddToken() {
  showAddToken.value = false
}

async function lookupToken() {
  addTokenError.value = ''
  if (!isAddress(newTokenAddress.value)) {
    addTokenError.value = t('dex.addToken.invalidAddress')
    return
  }
  addTokenLoading.value = true
  try {
    pendingToken.value = await readTokenMetadata(newTokenAddress.value)
  } catch (e) {
    console.error('[dex] token lookup failed:', e)
    addTokenError.value = t('dex.addToken.lookupFailed')
  } finally {
    addTokenLoading.value = false
  }
}

function confirmAddToken() {
  if (!pendingToken.value || !network.value) return
  addCustomToken(network.value.chainId, {
    symbol: pendingToken.value.symbol,
    name: pendingToken.value.name,
    address: pendingToken.value.address,
    decimals: pendingToken.value.decimals,
    logo: null,
    pinned: false,
    feeOnTransfer: pendingTokenFeeOnTransfer.value,
    custom: true,
  })
  showAddToken.value = false
  refreshBalances()
}

// --- Token bilgi modalı ---
const tokenInfoModal = ref(null)
const tokenAddressCopied = ref(false)
const confirmRemoveToken = ref(false)

const nativeAssetInfo = computed(() => {
  if (!network.value) return null
  return {
    symbol: network.value.nativeSymbol,
    name: network.value.nativeSymbol,
    address: null,
    decimals: network.value.nativeDecimals,
    formatted: nativeBalance.value?.formatted,
    pinned: true,
    custom: false,
    feeOnTransfer: false,
    // Native BNB/tBNB, WBNB ile aynı görsel işareti kullanır.
    logo: 'wbnb.webp',
  }
})

function openTokenInfo(asset) {
  tokenInfoModal.value = asset
  tokenAddressCopied.value = false
  confirmRemoveToken.value = false
}

function closeTokenInfo() {
  tokenInfoModal.value = null
}

function copyTokenAddress() {
  if (!tokenInfoModal.value?.address) return
  copy(tokenInfoModal.value.address)
  tokenAddressCopied.value = true
  setTimeout(() => { tokenAddressCopied.value = false }, 2000)
}

function removeTokenConfirmed() {
  if (!tokenInfoModal.value?.address || !network.value) return
  removeCustomToken(network.value.chainId, tokenInfoModal.value.address)
  closeTokenInfo()
  refreshBalances()
}

const tokenInfoFiatValue = computed(() => {
  if (!tokenInfoModal.value || tokenInfoModal.value.formatted == null) return null
  const key = tokenInfoModal.value.address ? tokenInfoModal.value.address.toLowerCase() : 'native'
  return fiatValueDisplay(key, tokenInfoModal.value.formatted)
})

// --- Fiat değeri: BSC'de kendi fiyat oracle'ımız yok, PancakeSwap
// router'ından bilinen bir stablecoin'e (USDT, yoksa BUSD) karşı quote
// alınarak yaklaşık bir USD birim fiyatı türetiliyor (bkz. tokenPricing.js).
// USD -> seçili fiat çevrimi mevcut navPrice.rates mekanizması yeniden
// kullanılarak yapılır (WalletBalance.vue'daki NAV fiyatıyla aynı kaynak).
const tokenUnitUsdPrices = ref({}) // 'native' | address.toLowerCase() -> number | null
let _priceRefreshInFlight = false

const stableAnchor = computed(() => {
  if (!network.value) return null
  const candidate =
    network.value.tokens.find((t) => t.symbol === 'USDT') ||
    network.value.tokens.find((t) => t.symbol === 'BUSD')
  if (!candidate || !isAddress(candidate.address)) return null
  return { address: getAddress(candidate.address), decimals: candidate.decimals }
})

async function refreshTokenPrices() {
  if (_priceRefreshInFlight) return
  if (!network.value || !stableAnchor.value) {
    tokenUnitUsdPrices.value = {}
    return
  }
  const client = getActiveClient()
  const routerAddress = getRouterAddress(network.value.chainId)
  const wrapped = getWrappedNative(network.value.chainId)
  if (!client || !routerAddress || !wrapped) return

  _priceRefreshInFlight = true
  try {
    const baseAddrs = getBaseTokenAddresses(network.value.chainId)
    const { address: stableAddr, decimals: stableDecimals } = stableAnchor.value

    const [nativePrice, ...tokenPrices] = await Promise.all([
      quoteTokenUsdPrice({
        client, routerAddress, tokenAddr: wrapped, tokenDecimals: network.value.nativeDecimals,
        stableAddr, stableDecimals, baseAddrs,
      }),
      ...tokenBalanceList.value.map((tok) =>
        quoteTokenUsdPrice({
          client, routerAddress, tokenAddr: tok.address, tokenDecimals: tok.decimals,
          stableAddr, stableDecimals, baseAddrs,
        })
      ),
    ])

    const next = { native: nativePrice }
    tokenBalanceList.value.forEach((tok, idx) => {
      next[tok.address.toLowerCase()] = tokenPrices[idx]
    })
    tokenUnitUsdPrices.value = next
  } catch (e) {
    console.error('[dex] token fiyatları alınamadı:', e)
  } finally {
    _priceRefreshInFlight = false
  }
}

// Bakiyeler her yenilendiğinde (30sn poll, pull-to-refresh, swap sonrası,
// token ekleme sonrası) fiyatlar da tazelenir — ayrı bir zamanlayıcı gerekmez.
watch(tokenBalanceList, () => { refreshTokenPrices() })
watch(() => settings.evmNetwork, () => { tokenUnitUsdPrices.value = {} })

function fiatValueDisplay(key, balanceFormatted) {
  if (!settings.showFiatValue) return null
  const unitPrice = tokenUnitUsdPrices.value[key]
  if (unitPrice == null) return null
  const amount = Number(balanceFormatted)
  if (!Number.isFinite(amount) || amount === 0) return null
  const currency = settings.currency ?? 'USD'
  const rate = navPrice.rates?.[currency]
  if (rate == null) return null
  return (amount * unitPrice * rate).toLocaleString(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// --- Pull-to-refresh: yalnızca dış scroll konteyneri (App.vue) en üstteyken tetiklenir ---
const pulling = ref(false)
const pullDistance = ref(0)
let touchStartY = 0

function scrollRoot() {
  return document.querySelector('[data-scroll-root]')
}

function onTouchStart(e) {
  const root = scrollRoot()
  if (!root || root.scrollTop > 0) return
  touchStartY = e.touches[0].clientY
  pulling.value = true
}

function onTouchMove(e) {
  if (!pulling.value) return
  const delta = e.touches[0].clientY - touchStartY
  pullDistance.value = Math.max(0, Math.min(delta, 100))
}

async function onTouchEnd() {
  if (pulling.value && pullDistance.value > 70) {
    await handleRefresh()
  }
  pulling.value = false
  pullDistance.value = 0
}

// ============================= Faz 2: Swap =============================
const swap = usePancakeSwap()

onMounted(async () => {
  if (!settings.dexMode) return
  // WalletBalance.vue ile aynı desen: fiyat/FX polling'i showFiatValue'dan
  // bağımsız her zaman başlar, gösterim şablonda ayrıca kapalı tutulur.
  startPricePolling()
  try {
    await deriveEvmAddress(0)
    startBalancePolling(30_000)
  } catch (e) {
    console.error('[dex] derivation error:', e)
    if (e.message === 'wallet_locked') derivationError.value = t('dex.errors.walletLocked')
    else if (e.message === 'wallet_not_ready') derivationError.value = t('dex.errors.walletNotReady')
    else derivationError.value = t('dex.errors.derivationFailed')
  }
})

onUnmounted(() => {
  stopBalancePolling()
  stopPricePolling()
  // Sadece fiyat teklifi polling'i durur — devam eden bir executeSwap()
  // çağrısı (approve/swap receipt beklemesi) kesilmez: status/txHash modül
  // kapsamında tutulduğu için sayfa yeniden açıldığında kaldığı yerden
  // görünmeye devam eder (bkz. usePancakeSwap.js).
  swap.stopQuotePolling()
})

const fromAssetKey = ref('native')
const toAssetKey = ref('')
const amountInput = ref('')
const highImpactAcked = ref(false)
const showHighImpactConfirm = ref(false)

const assetOptions = computed(() => {
  if (!network.value) return []
  const native = {
    key: 'native',
    isNative: true,
    symbol: network.value.nativeSymbol,
    decimals: network.value.nativeDecimals,
    feeOnTransfer: false,
  }
  const tokens = tokenBalanceList.value.map((tok) => ({
    key: tok.address,
    isNative: false,
    address: tok.address,
    symbol: tok.symbol,
    decimals: tok.decimals,
    feeOnTransfer: !!tok.feeOnTransfer,
  }))
  return [native, ...tokens]
})

// Token listesi ilk kez dolduğunda "to" için makul bir varsayılan seç.
watch(
  assetOptions,
  (opts) => {
    if (toAssetKey.value) return
    const firstOther = opts.find((o) => o.key !== fromAssetKey.value)
    if (firstOther) toAssetKey.value = firstOther.key
  },
  { immediate: true }
)

const fromAsset = computed(() => assetOptions.value.find((a) => a.key === fromAssetKey.value) || null)
const toAsset = computed(() => assetOptions.value.find((a) => a.key === toAssetKey.value) || null)

const isBusy = computed(() => ['approving', 'approve_pending', 'swapping', 'swap_pending'].includes(swap.status.value))

const amountInRaw = computed(() => {
  if (!fromAsset.value || !amountInput.value) return 0n
  try {
    return parseUnits(String(amountInput.value), fromAsset.value.decimals)
  } catch {
    return 0n
  }
})

const fromBalanceRaw = computed(() => {
  if (!fromAsset.value) return 0n
  if (fromAsset.value.isNative) return nativeBalance.value?.raw ?? 0n
  const found = tokenBalanceList.value.find((t) => t.address === fromAsset.value.address)
  return found?.balance ?? 0n
})

const fromBalanceDisplay = computed(() =>
  fromAsset.value ? formatDisplay(formatUnits(fromBalanceRaw.value, fromAsset.value.decimals)) : '—'
)

const insufficientBalance = computed(() => amountInRaw.value > 0n && amountInRaw.value > fromBalanceRaw.value)
const sameAsset = computed(() => !!fromAssetKey.value && fromAssetKey.value === toAssetKey.value)

const priceImpactPct = computed(() =>
  swap.priceImpactBps.value !== null ? swap.priceImpactBps.value / 100 : null
)
const priceImpactDisplay = computed(() =>
  priceImpactPct.value !== null ? `${priceImpactPct.value.toFixed(2)}%` : '—'
)
const priceImpactClass = computed(() => {
  if (priceImpactPct.value === null) return 'text-gray-500 dark:text-gray-400'
  if (priceImpactPct.value > 15) return 'text-red-600 dark:text-red-400 font-semibold'
  if (priceImpactPct.value > 5) return 'text-red-500 dark:text-red-400'
  return 'text-gray-500 dark:text-gray-400'
})

const estimatedOutDisplay = computed(() => {
  if (!swap.quote.value || !toAsset.value) return '0.0'
  return formatDisplay(formatUnits(swap.quote.value.amountOut, toAsset.value.decimals))
})

const minReceivedDisplay = computed(() => {
  if (!swap.quote.value || !toAsset.value) return '—'
  return `${formatDisplay(formatUnits(swap.quote.value.amountOutMin, toAsset.value.decimals))} ${toAsset.value.symbol}`
})

// path'in uçları seçilen varlığın kendi sembolüyle gösterilir (native ise
// "BNB", WBNB değil); yalnızca aradaki baz token için registry'den bakılır.
const pathSymbolsDisplay = computed(() => {
  if (!swap.quote.value || !fromAsset.value || !toAsset.value) return ''
  const path = swap.quote.value.path
  return path
    .map((addr, idx) => {
      if (idx === 0) return fromAsset.value.symbol
      if (idx === path.length - 1) return toAsset.value.symbol
      const found = tokenBalanceList.value.find((t) => t.address.toLowerCase() === addr.toLowerCase())
      return found?.symbol || `${addr.slice(0, 6)}…`
    })
    .join(' → ')
})

const successAmountDisplay = computed(() => {
  if (swap.actualAmountOut.value === null || !toAsset.value) return ''
  return `${formatDisplay(formatUnits(swap.actualAmountOut.value, toAsset.value.decimals))} ${toAsset.value.symbol}`
})

function explorerTxUrl(hash) {
  if (!network.value?.explorer || !hash) return null
  return `${network.value.explorer}/tx/${hash}`
}

const canSwap = computed(() => {
  if (!evmAddress.value || !network.value) return false
  if (sameAsset.value) return false
  if (amountInRaw.value <= 0n) return false
  if (insufficientBalance.value) return false
  if (isBusy.value) return false
  if (!swap.quote.value) return false
  return true
})

const swapButtonLabel = computed(() => {
  if (swap.status.value === 'success') return t('dex.swap.swapAgain')
  if (swap.status.value === 'approving') return t('dex.swap.approving')
  if (swap.status.value === 'approve_pending') return t('dex.swap.approvePending')
  if (swap.status.value === 'swapping') return t('dex.swap.preparing')
  if (swap.status.value === 'swap_pending') return t('dex.swap.pending')
  if (sameAsset.value) return t('dex.swap.selectDifferent')
  if (insufficientBalance.value) return t('dex.swap.insufficientBalance')
  if (swap.needsApproval.value) return t('dex.swap.approveAndSwap')
  return t('dex.swap.swapButton')
})

function currentSwapParams() {
  if (!network.value || !evmAddress.value) return null
  return {
    chainId: network.value.chainId,
    owner: evmAddress.value,
    fromAsset: fromAsset.value,
    toAsset: toAsset.value,
    amountInRaw: amountInRaw.value,
  }
}

function flipAssets() {
  const prevFrom = fromAssetKey.value
  fromAssetKey.value = toAssetKey.value
  toAssetKey.value = prevFrom
}

function setMaxAmount() {
  if (!fromAsset.value) return
  amountInput.value = formatUnits(fromBalanceRaw.value, fromAsset.value.decimals)
}

function resetSwapForm() {
  swap.reset()
  amountInput.value = ''
  highImpactAcked.value = false
}

async function runSwap() {
  await swap.executeSwap({
    chainId: network.value.chainId,
    fromAsset: fromAsset.value,
    toAsset: toAsset.value,
    amountInRaw: amountInRaw.value,
  })
  if (swap.status.value === 'success') {
    highImpactAcked.value = false
    refreshBalances()
  }
}

async function handleSwapClick() {
  if (swap.status.value === 'success') {
    resetSwapForm()
    return
  }
  if (!canSwap.value) return
  if (priceImpactPct.value !== null && priceImpactPct.value > 15 && !highImpactAcked.value) {
    showHighImpactConfirm.value = true
    return
  }
  await runSwap()
}

function confirmHighImpact() {
  highImpactAcked.value = true
  showHighImpactConfirm.value = false
  runSwap()
}

let _quoteDebounce = null
watch([fromAssetKey, toAssetKey, amountInput], () => {
  if (swap.status.value === 'success' || swap.status.value === 'error') swap.reset()
  highImpactAcked.value = false
  if (_quoteDebounce) clearTimeout(_quoteDebounce)
  _quoteDebounce = setTimeout(() => {
    const params = currentSwapParams()
    if (params && !sameAsset.value && params.amountInRaw > 0n) {
      swap.startQuotePolling(currentSwapParams, 15_000)
    } else {
      swap.stopQuotePolling()
      swap.reset()
    }
  }, 400)
})

// Ağ değişince adres aynı kalır ama eski path/quote artık geçersizdir.
watch(() => settings.evmNetwork, () => {
  swap.stopQuotePolling()
  swap.reset()
  toAssetKey.value = ''
})
</script>

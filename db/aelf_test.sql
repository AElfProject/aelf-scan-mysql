-- MySQL dump 10.13  Distrib 5.7.27, for Linux (x86_64)
--
-- Host: 127.0.0.1    Database: aelf_test
-- ------------------------------------------------------
-- Server version	5.7.27

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `address_contracts`
--

DROP TABLE IF EXISTS `address_contracts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `address_contracts` (
  `address` varchar(64) NOT NULL,
  `contract_address` varchar(64) NOT NULL,
  `symbol` varchar(64) NOT NULL,
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`address`,`contract_address`,`symbol`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `blocks_0`
--

DROP TABLE IF EXISTS `blocks_0`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `blocks_0` (
  `block_hash` varchar(64) NOT NULL,
  `pre_block_hash` varchar(64) NOT NULL,
  `chain_id` varchar(64) NOT NULL,
  `block_height` int(64) NOT NULL,
  `tx_count` int(32) NOT NULL,
  `merkle_root_tx` varchar(64) NOT NULL,
  `merkle_root_state` varchar(64) NOT NULL,
  `time` varchar(64) NOT NULL COMMENT '直接转存节点来的',
  PRIMARY KEY (`block_hash`),
  KEY `block_hash` (`block_hash`),
  KEY `block_height` (`block_height`),
  KEY `time` (`time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `blocks_unconfirmed`
--

DROP TABLE IF EXISTS `blocks_unconfirmed`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `blocks_unconfirmed` (
  `block_hash` varchar(64) NOT NULL,
  `pre_block_hash` varchar(64) NOT NULL,
  `chain_id` varchar(64) NOT NULL,
  `block_height` int(64) NOT NULL,
  `tx_count` int(32) NOT NULL,
  `merkle_root_tx` varchar(64) NOT NULL,
  `merkle_root_state` varchar(64) NOT NULL,
  `time` varchar(64) NOT NULL COMMENT '直接转存节点来的',
  PRIMARY KEY (`block_hash`),
  KEY `block_hash` (`block_hash`),
  KEY `block_height` (`block_height`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `contract_aelf20`
--

DROP TABLE IF EXISTS `contract_aelf20`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `contract_aelf20` (
  `contract_address` varchar(64) NOT NULL,
  `symbol` varchar(64) NOT NULL,
  `chain_id` varchar(64) NOT NULL,
  `block_hash` varchar(64) NOT NULL,
  `tx_id` varchar(64) NOT NULL,
  `name` varchar(64) NOT NULL,
  `total_supply` bigint(64) unsigned NOT NULL,
  `decimals` int(32) DEFAULT NULL,
  PRIMARY KEY (`symbol`,`contract_address`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nodes_0`
--

DROP TABLE IF EXISTS `nodes_0`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `nodes_0` (
  `contract_address` varchar(64) NOT NULL COMMENT 'token contract address',
  `chain_id` varchar(64) NOT NULL,
  `api_ip` varchar(128) NOT NULL,
  `api_domain` varchar(255) NOT NULL,
  `rpc_ip` varchar(128) NOT NULL,
  `rpc_domain` varchar(255) NOT NULL,
  `token_name` varchar(255) NOT NULL,
  `owner` varchar(255) NOT NULL,
  `status` int(1) NOT NULL,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`contract_address`,`chain_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `resource_0`
--

DROP TABLE IF EXISTS `resource_0`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `resource_0` (
  `tx_id` varchar(64) NOT NULL,
  `address` varchar(64) NOT NULL,
  `method` varchar(64) NOT NULL,
  `type` varchar(8) NOT NULL COMMENT 'resource type',
  `resource` int(64) NOT NULL COMMENT 'quantity of resource',
  `elf` int(64) NOT NULL COMMENT 'quantity of resource',
  `fee` int(64) NOT NULL COMMENT 'quantity of resource',
  `chain_id` varchar(64) NOT NULL,
  `block_height` int(32) NOT NULL,
  `tx_status` varchar(64) NOT NULL,
  `time` bigint(64) NOT NULL,
  PRIMARY KEY (`tx_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `resource_unconfirmed`
--

DROP TABLE IF EXISTS `resource_unconfirmed`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `resource_unconfirmed` (
  `tx_id` varchar(64) NOT NULL,
  `address` varchar(64) NOT NULL,
  `method` varchar(64) NOT NULL,
  `type` varchar(8) NOT NULL COMMENT 'resource type',
  `resource` int(64) NOT NULL COMMENT 'quantity of resource',
  `elf` int(64) NOT NULL COMMENT 'quantity of resource',
  `fee` int(64) NOT NULL COMMENT 'quantity of resource',
  `chain_id` varchar(64) NOT NULL,
  `block_height` int(32) NOT NULL,
  `tx_status` varchar(64) NOT NULL,
  `time` bigint(64) NOT NULL,
  PRIMARY KEY (`tx_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tps_0`
--

DROP TABLE IF EXISTS `tps_0`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tps_0` (
  `start` varchar(255) NOT NULL COMMENT 'start time, fromblocks_0',
  `end` varchar(255) NOT NULL COMMENT 'start + N(the value of key: type)',
  `txs` int(32) NOT NULL COMMENT 'tx count during N minutes',
  `blocks` int(32) NOT NULL COMMENT 'block count during N minutes',
  `tps` int(32) NOT NULL COMMENT 'transactions per second',
  `tpm` int(32) NOT NULL COMMENT 'transactions per minute',
  `type` int(16) NOT NULL COMMENT 'N, interval time',
  PRIMARY KEY (`start`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `transactions_0`
--

DROP TABLE IF EXISTS `transactions_0`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `transactions_0` (
  `tx_id` varchar(64) NOT NULL,
  `params_to` varchar(64) NOT NULL DEFAULT '-1' COMMENT 'target address',
  `chain_id` varchar(64) NOT NULL,
  `block_height` int(32) unsigned NOT NULL,
  `address_from` varchar(64) NOT NULL,
  `address_to` varchar(64) NOT NULL COMMENT 'contract address',
  `params` text NOT NULL,
  `method` varchar(64) NOT NULL,
  `block_hash` varchar(64) NOT NULL,
  `quantity` bigint(64) unsigned NOT NULL,
  `tx_status` varchar(64) NOT NULL,
  `time` varchar(64) NOT NULL COMMENT 'time of blocks',
  PRIMARY KEY (`tx_id`,`params_to`),
  KEY `params_to` (`params_to`),
  KEY `method` (`method`),
  KEY `address_to` (`address_to`),
  KEY `address_from` (`address_from`),
  KEY `block_height` (`block_height`),
  KEY `block_hash` (`block_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `transactions_unconfirmed`
--

DROP TABLE IF EXISTS `transactions_unconfirmed`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `transactions_unconfirmed` (
  `tx_id` varchar(64) NOT NULL,
  `params_to` varchar(64) NOT NULL DEFAULT '-1' COMMENT 'target address',
  `chain_id` varchar(64) NOT NULL,
  `block_height` int(32) unsigned NOT NULL,
  `address_from` varchar(64) NOT NULL,
  `address_to` varchar(64) NOT NULL COMMENT 'contract address',
  `params` text NOT NULL,
  `method` varchar(64) NOT NULL,
  `block_hash` varchar(64) NOT NULL,
  `quantity` bigint(64) unsigned NOT NULL,
  `tx_status` varchar(64) NOT NULL,
  `time` varchar(64) NOT NULL COMMENT 'time of blocks',
  PRIMARY KEY (`tx_id`,`params_to`),
  KEY `params_to` (`params_to`),
  KEY `method` (`method`),
  KEY `address_to` (`address_to`),
  KEY `address_from` (`address_from`),
  KEY `block_height` (`block_height`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user`
--

DROP TABLE IF EXISTS `user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user` (
  `id` int(255) NOT NULL,
  `address` varchar(255) COLLATE utf8mb4_bin DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_bin DEFAULT NULL,
  `avatar_url` varchar(255) COLLATE utf8mb4_bin DEFAULT NULL,
  `phone` varchar(255) COLLATE utf8mb4_bin DEFAULT NULL,
  `password` varchar(255) COLLATE utf8mb4_bin DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `whitelist`
--

DROP TABLE IF EXISTS `whitelist`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `whitelist` (
  `ip` varchar(128) NOT NULL COMMENT 'You can allow the ip use get or post of your API.',
  `domain` varchar(255) DEFAULT NULL,
  `type` varchar(16) DEFAULT NULL COMMENT 'get/post',
  PRIMARY KEY (`ip`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2019-08-20  7:37:23
